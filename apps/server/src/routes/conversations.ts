/**
 * Couple ↔ vendor messaging (spec §8) and the inquiry that starts it (spec §5: Message,
 * Check Availability, Request Quote). An inquiry creates or reuses ONE lead and ONE thread
 * per couple–vendor pair (both enforced by unique constraints).
 */
import { and, desc, eq, gt, ne, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  formatDayShortHe,
  inquirySchema,
  messageSendSchema,
  type ConversationDetail,
  type ConversationListItem,
} from '@soon/shared';

import { db } from '../db';
import { category, conversation, lead, message, vendor, vendorPackage, wedding } from '../db/schema';
import { badRequest, isUuid, notFound } from '../http';
import { findWeddingForUser, parseBody, requireOwnVendor, requireUser, requireWedding, type SessionUser } from '../session';

type Side = { side: 'vendor'; vendorId: string } | { side: 'couple'; weddingId: string };

/** Which side of conversations the user is on: owner of a vendor, or a partner in a wedding. */
async function sideOf(user: SessionUser): Promise<Side | null> {
  if (user.role === 'vendor' || user.role === 'admin') {
    const [v] = await db.select({ id: vendor.id }).from(vendor).where(eq(vendor.ownerUserId, user.id)).limit(1);
    if (v) return { side: 'vendor', vendorId: v.id };
  }
  if (user.role === 'couple') {
    const w = await findWeddingForUser(user.id);
    if (w) return { side: 'couple', weddingId: w.id };
  }
  return null;
}

const sideFilter = (s: Side) => (s.side === 'vendor' ? eq(conversation.vendorId, s.vendorId) : eq(conversation.weddingId, s.weddingId));

/** Messages the viewer hasn't read: sent by the other side after the viewer's read mark. */
function unreadSql(s: Side, userId: string) {
  const readAt = s.side === 'vendor' ? conversation.vendorReadAt : conversation.weddingReadAt;
  return sql<number>`(select count(*)::int from ${message} m
    where m.conversation_id = ${conversation.id} and m.sender_user_id <> ${userId}
      and (${readAt} is null or m.created_at > ${readAt}))`;
}

async function listConversations(s: Side, userId: string, where?: ReturnType<typeof eq>): Promise<ConversationListItem[]> {
  const rows = await db
    .select({
      id: conversation.id,
      vendorId: vendor.id,
      slug: vendor.slug,
      businessName: vendor.businessName,
      logoUrl: vendor.logoUrl,
      categoryLabel: category.labelHe,
      weddingId: wedding.id,
      p1: wedding.partner1Name,
      p2: wedding.partner2Name,
      leadId: conversation.leadId,
      leadStatus: lead.status,
      last: sql<{ body: string | null; at: string; sender: string } | null>`(
        select json_build_object('body', m.body, 'at', m.created_at, 'sender', m.sender_user_id)
        from ${message} m where m.conversation_id = ${conversation.id} order by m.created_at desc limit 1)`,
      unread: unreadSql(s, userId),
    })
    .from(conversation)
    .innerJoin(vendor, eq(vendor.id, conversation.vendorId))
    .innerJoin(category, eq(category.slug, vendor.categorySlug))
    .innerJoin(wedding, eq(wedding.id, conversation.weddingId))
    .leftJoin(lead, eq(lead.id, conversation.leadId))
    .where(and(sideFilter(s), where))
    .orderBy(sql`${conversation.lastMessageAt} desc nulls last`)
    .limit(200);

  return rows.map((r) => ({
    id: r.id,
    vendor: { id: r.vendorId, slug: r.slug, businessName: r.businessName, logoUrl: r.logoUrl, categoryLabel: r.categoryLabel },
    couple: { weddingId: r.weddingId, names: `${r.p1} ו${r.p2}` },
    lastMessage: r.last ? { body: r.last.body, at: new Date(r.last.at).toISOString(), mine: r.last.sender === userId } : null,
    unread: r.unread,
    leadId: r.leadId,
    leadStatus: r.leadStatus,
  }));
}

/** Total unread messages for the viewer (tab badges). */
export async function unreadTotal(s: Side, userId: string) {
  const readAt = s.side === 'vendor' ? conversation.vendorReadAt : conversation.weddingReadAt;
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .where(
      and(
        sideFilter(s),
        ne(message.senderUserId, userId),
        or(sql`${readAt} is null`, gt(message.createdAt, sql`${readAt}`)),
      ),
    );
  return r?.n ?? 0;
}

async function postMessage(conversationId: string, senderUserId: string, body: string, side: Side['side']) {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(message).values({ conversationId, senderUserId, body, createdAt: now });
    await tx
      .update(conversation)
      .set({ lastMessageAt: now, ...(side === 'vendor' ? { vendorReadAt: now } : { weddingReadAt: now }) })
      .where(eq(conversation.id, conversationId));
  });
}

const INQUIRY_PREFIX = { message: '', quote: 'בקשה להצעת מחיר', availability: 'בדיקת זמינות' } as const;

export async function conversationRoutes(app: FastifyInstance) {
  /** Vendor: add the couple of a conversation to the CRM (when auto-add is off, or the lead was removed). */
  app.post<{ Params: { id: string } }>('/api/conversations/:id/lead', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [c] = await db
      .select({ id: conversation.id, weddingId: conversation.weddingId, leadId: conversation.leadId })
      .from(conversation)
      .where(and(eq(conversation.id, request.params.id), eq(conversation.vendorId, ctx.vendor.id)));
    if (!c) return notFound(reply);
    if (c.leadId) return { leadId: c.leadId };
    const [w] = await db.select().from(wedding).where(eq(wedding.id, c.weddingId));
    const [l] = await db
      .insert(lead)
      .values({
        vendorId: ctx.vendor.id,
        weddingId: c.weddingId,
        source: 'app',
        status: 'new',
        eventDate: w?.weddingDate ?? null,
        location: w?.venueName ?? null,
      })
      .onConflictDoUpdate({ target: [lead.vendorId, lead.weddingId], set: { updatedAt: new Date() } })
      .returning({ id: lead.id });
    await db.update(conversation).set({ leadId: l!.id }).where(eq(conversation.id, c.id));
    return reply.status(201).send({ leadId: l!.id });
  });

  /** A couple contacts a vendor. Creates/reuses the lead and the thread, then posts the message. */
  app.post<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/inquiries', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    const body = await parseBody(inquirySchema, request.body, reply);
    if (!body) return;
    const [v] = await db
      .select({ id: vendor.id, settings: vendor.settings })
      .from(vendor)
      .where(and(eq(vendor.id, request.params.vendorId), eq(vendor.status, 'approved')));
    if (!v) return notFound(reply);
    if (body.packageId) {
      const ok = await db.$count(vendorPackage, and(eq(vendorPackage.id, body.packageId), eq(vendorPackage.vendorId, v.id)));
      if (!ok) return badRequest(reply, 'Unknown package', 'packageId');
    }
    const w = ctx.wedding;
    const eventDate = body.eventDate ?? w.weddingDate;

    // Vendors can turn off "add every inquiry to my clients"; they then add from the chat.
    const autoLead = v.settings.autoLeadFromInquiry !== false;
    const existingLead = autoLead
      ? null
      : (await db.select({ id: lead.id }).from(lead).where(and(eq(lead.vendorId, v.id), eq(lead.weddingId, w.id))))[0];

    const conversationId = await db.transaction(async (tx) => {
      if (!autoLead) {
        const [c] = await tx
          .insert(conversation)
          .values({ vendorId: v.id, weddingId: w.id, leadId: existingLead?.id ?? null })
          .onConflictDoNothing()
          .returning({ id: conversation.id });
        if (c) return c.id;
        const [found] = await tx
          .select({ id: conversation.id })
          .from(conversation)
          .where(and(eq(conversation.vendorId, v.id), eq(conversation.weddingId, w.id)));
        return found!.id;
      }
      const [l] = await tx
        .insert(lead)
        .values({
          vendorId: v.id,
          weddingId: w.id,
          source: 'app',
          status: 'new',
          eventDate,
          location: w.venueName,
          guestCount: body.guestCount ?? null,
          packageId: body.packageId ?? null,
        })
        .onConflictDoUpdate({
          target: [lead.vendorId, lead.weddingId],
          // A returning couple reopens a closed-off lead; otherwise keep the vendor's pipeline status.
          set: {
            status: sql`case when ${lead.status} in ('lost', 'cancelled') then 'new'::lead_status else ${lead.status} end`,
            guestCount: sql`coalesce(excluded.guest_count, ${lead.guestCount})`,
            packageId: sql`coalesce(excluded.package_id, ${lead.packageId})`,
            eventDate: sql`coalesce(${lead.eventDate}, excluded.event_date)`,
          },
        })
        .returning({ id: lead.id });
      const [c] = await tx
        .insert(conversation)
        .values({ vendorId: v.id, weddingId: w.id, leadId: l!.id })
        .onConflictDoUpdate({ target: [conversation.vendorId, conversation.weddingId], set: { leadId: l!.id } })
        .returning({ id: conversation.id });
      return c!.id;
    });

    const details = [
      INQUIRY_PREFIX[body.kind],
      eventDate ? `תאריך: ${formatDayShortHe(eventDate)}` : '',
      body.guestCount ? `מוזמנים: ${body.guestCount}` : '',
    ].filter(Boolean);
    const text = details.length ? `${details.join(' · ')}\n\n${body.message}` : body.message;
    await postMessage(conversationId, ctx.user.id, text, 'couple');
    return reply.status(201).send({ conversationId });
  });

  app.get('/api/conversations', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const s = await sideOf(user);
    if (!s) return [];
    return listConversations(s, user.id);
  });

  app.get('/api/unread', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const s = await sideOf(user);
    return { messages: s ? await unreadTotal(s, user.id) : 0 };
  });

  /** Thread + context. Opening it marks it read for the viewer's side. */
  app.get<{ Params: { id: string } }>('/api/conversations/:id', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const s = await sideOf(user);
    if (!s) return notFound(reply);
    const [item] = await listConversations(s, user.id, eq(conversation.id, request.params.id));
    if (!item) return notFound(reply);

    const now = new Date();
    const [[c], msgs, [ctxRow]] = await Promise.all([
      db
        .update(conversation)
        .set(s.side === 'vendor' ? { vendorReadAt: now } : { weddingReadAt: now })
        .where(eq(conversation.id, item.id))
        .returning(),
      db.select().from(message).where(eq(message.conversationId, item.id)).orderBy(desc(message.createdAt)).limit(300),
      db
        .select({
          eventDate: lead.eventDate,
          guestCount: lead.guestCount,
          quoted: lead.quotedPriceAgorot,
          region: wedding.region,
          venueName: wedding.venueName,
          weddingDate: wedding.weddingDate,
        })
        .from(wedding)
        .leftJoin(lead, eq(lead.id, sql`${item.leadId}::uuid`))
        .where(eq(wedding.id, item.couple.weddingId)),
    ]);

    const detail: ConversationDetail = {
      conversation: { ...item, unread: 0 },
      messages: msgs.reverse().map((m) => ({
        id: m.id,
        body: m.body,
        attachmentUrl: m.attachmentUrl,
        createdAt: m.createdAt.toISOString(),
        mine: m.senderUserId === user.id,
      })),
      otherReadAt: (s.side === 'vendor' ? c?.weddingReadAt : c?.vendorReadAt)?.toISOString() ?? null,
      context: {
        eventDate: ctxRow?.eventDate ?? ctxRow?.weddingDate ?? null,
        guestCount: ctxRow?.guestCount ?? null,
        region: ctxRow?.region ?? null,
        venueName: ctxRow?.venueName ?? null,
        quotedPriceAgorot: ctxRow?.quoted ?? null,
      },
      viewerSide: s.side,
    };
    return detail;
  });

  app.post<{ Params: { id: string } }>('/api/conversations/:id/messages', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const body = await parseBody(messageSendSchema, request.body, reply);
    if (!body) return;
    const s = await sideOf(user);
    if (!s) return notFound(reply);
    const [c] = await db
      .select({ id: conversation.id, leadId: conversation.leadId })
      .from(conversation)
      .where(and(eq(conversation.id, request.params.id), sideFilter(s)));
    if (!c) return notFound(reply);
    await postMessage(c.id, user.id, body.body, s.side);
    // A vendor replying to a new lead has made contact (spec §10 pipeline).
    if (s.side === 'vendor' && c.leadId) {
      await db.update(lead).set({ status: 'contacted' }).where(and(eq(lead.id, c.leadId), eq(lead.status, 'new')));
    }
    return reply.status(201).send({ ok: true });
  });
}
