/**
 * Couples together: partner invite links (two partners, one wedding), couples' reviews of vendors,
 * and the opt-in couples community with couple ↔ couple chat.
 */
import { randomBytes } from 'node:crypto';

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  communityProfileSchema,
  coupleMessageSchema,
  reviewInputSchema,
  reviewReplySchema,
  type CommunityCoupleDTO,
  type CoupleChatDetail,
  type CoupleChatListItem,
  type MyReviewDTO,
} from '@soon/shared';

import { db } from '../db';
import { coupleChat, coupleChatMessage, lead, review, user, vendor, wedding, weddingInvite, weddingMember } from '../db/schema';
import { badRequest, conflict, isUuid, notFound } from '../http';
import { findWeddingForUser, parseBody, requireOwnVendor, requireUser, requireWedding } from '../session';

const INVITE_DAYS = 14;
const namesOf = (w: { partner1Name: string; partner2Name: string }) => `${w.partner1Name} ו${w.partner2Name}`;

/** Unread couple-chat messages for a wedding (added to the couple's message badge). */
export async function coupleChatUnread(weddingId: string, userId: string): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n
    from couple_chat_message m join couple_chat c on c.id = m.chat_id
    where (c.wedding_a_id = ${weddingId} or c.wedding_b_id = ${weddingId})
      and m.sender_user_id <> ${userId}
      and not exists (select 1 from wedding_member wm where wm.wedding_id = ${weddingId} and wm.user_id = m.sender_user_id)
      and m.created_at > coalesce(case when c.wedding_a_id = ${weddingId} then c.a_read_at else c.b_read_at end, 'epoch'::timestamptz)`);
  return rows.rows[0]?.n ?? 0;
}

async function listChats(weddingId: string, userId: string, chatId?: string): Promise<CoupleChatListItem[]> {
  const rows = await db.execute<{
    id: string;
    other_id: string;
    other_names: string;
    last_body: string | null;
    last_at: string | null;
    last_sender: string | null;
    unread: number;
  }>(sql`
    select c.id,
      o.id as other_id, o.partner1_name || ' ו' || o.partner2_name as other_names,
      lm.body as last_body, lm.created_at as last_at, lm.sender_user_id as last_sender,
      (select count(*)::int from couple_chat_message m
        where m.chat_id = c.id
          and not exists (select 1 from wedding_member wm where wm.wedding_id = ${weddingId} and wm.user_id = m.sender_user_id)
          and m.created_at > coalesce(case when c.wedding_a_id = ${weddingId} then c.a_read_at else c.b_read_at end, 'epoch'::timestamptz)
      ) as unread
    from couple_chat c
    join wedding o on o.id = case when c.wedding_a_id = ${weddingId} then c.wedding_b_id else c.wedding_a_id end
    left join lateral (select body, created_at, sender_user_id from couple_chat_message
      where chat_id = c.id order by created_at desc limit 1) lm on true
    where (c.wedding_a_id = ${weddingId} or c.wedding_b_id = ${weddingId})
      ${chatId ? sql`and c.id = ${chatId}` : sql``}
    order by coalesce(c.last_message_at, c.created_at) desc
    limit 200`);
  return rows.rows.map((r) => ({
    id: r.id,
    other: { weddingId: r.other_id, names: r.other_names },
    lastMessage: r.last_body ? { body: r.last_body, at: new Date(r.last_at!).toISOString(), mine: r.last_sender === userId } : null,
    unread: r.unread,
  }));
}

export async function coupleSocialRoutes(app: FastifyInstance) {
  // ===== partner invite =====
  /** A partner creates a join link for the other partner (valid 14 days). */
  app.post('/api/weddings/me/invites', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const token = randomBytes(18).toString('base64url');
    await db.insert(weddingInvite).values({
      token,
      weddingId: ctx.wedding.id,
      createdByUserId: ctx.user.id,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    });
    return reply.status(201).send({ token, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() });
  });

  /** Public: what the invite is for (landing page before sign-in). */
  app.get<{ Params: { token: string } }>('/api/invites/:token', async (request, reply) => {
    const [row] = await db
      .select({ i: weddingInvite, w: wedding, inviter: user.name })
      .from(weddingInvite)
      .innerJoin(wedding, eq(wedding.id, weddingInvite.weddingId))
      .leftJoin(user, eq(user.id, weddingInvite.createdByUserId))
      .where(eq(weddingInvite.token, request.params.token));
    if (!row) return notFound(reply);
    const valid = !row.i.usedAt && row.i.expiresAt > new Date();
    return { valid, names: namesOf(row.w), weddingDate: row.w.weddingDate, inviterName: row.inviter?.split(' ')[0] ?? null };
  });

  /** The signed-in user joins the wedding as a partner. */
  app.post<{ Params: { token: string } }>('/api/invites/:token/accept', async (request, reply) => {
    const u = await requireUser(request, reply);
    if (!u) return;
    if (u.role && u.role !== 'couple') return badRequest(reply, 'החשבון הזה הוא חשבון ספק. היכנסו עם חשבון זוג.');
    const existing = await findWeddingForUser(u.id);
    const [inv] = await db.select().from(weddingInvite).where(eq(weddingInvite.token, request.params.token));
    if (!inv) return notFound(reply);
    if (existing?.id === inv.weddingId) return { weddingId: inv.weddingId };
    if (existing) return conflict(reply, 'כבר יש לחשבון הזה חתונה משלו.');
    if (inv.usedAt || inv.expiresAt <= new Date()) return badRequest(reply, 'הקישור כבר נוצל או שפג תוקפו. בקשו קישור חדש.');

    const joined = await db.transaction(async (tx) => {
      // Claim the token atomically: two people can't both use one link.
      const [claimed] = await tx
        .update(weddingInvite)
        .set({ usedAt: new Date(), usedByUserId: u.id })
        .where(and(eq(weddingInvite.token, inv.token), isNull(weddingInvite.usedAt)))
        .returning({ token: weddingInvite.token });
      if (!claimed) return false;
      await tx.insert(weddingMember).values({ weddingId: inv.weddingId, userId: u.id, role: 'partner' }).onConflictDoNothing();
      if (!u.role) await tx.update(user).set({ role: 'couple' }).where(eq(user.id, u.id));
      return true;
    });
    if (!joined) return badRequest(reply, 'הקישור כבר נוצל. בקשו קישור חדש.');
    return { weddingId: inv.weddingId };
  });

  // ===== reviews (couples) =====
  app.get<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/my-review', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    const [r] = await db
      .select()
      .from(review)
      .where(and(eq(review.vendorId, request.params.vendorId), eq(review.weddingId, ctx.wedding.id)));
    const dto: MyReviewDTO = r
      ? {
          id: r.id,
          rating: r.rating,
          ratingProfessionalism: r.ratingProfessionalism,
          ratingService: r.ratingService,
          ratingAvailability: r.ratingAvailability,
          ratingValue: r.ratingValue,
          body: r.body,
        }
      : null;
    return { review: dto };
  });

  /** Write or update the couple's review. "Verified" when they booked the vendor through SOON. */
  app.put<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/my-review', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    const b = await parseBody(reviewInputSchema, request.body, reply);
    if (!b) return;
    const [v] = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(and(eq(vendor.id, request.params.vendorId), eq(vendor.status, 'approved')));
    if (!v) return notFound(reply);
    const verified =
      (await db.$count(
        lead,
        and(eq(lead.vendorId, v.id), eq(lead.weddingId, ctx.wedding.id), sql`${lead.status} in ('booked', 'completed')`),
      )) > 0;
    const values = {
      rating: b.rating,
      ratingProfessionalism: b.ratingProfessionalism ?? null,
      ratingService: b.ratingService ?? null,
      ratingAvailability: b.ratingAvailability ?? null,
      ratingValue: b.ratingValue ?? null,
      body: b.body,
      verified,
    };
    await db
      .insert(review)
      .values({ vendorId: v.id, weddingId: ctx.wedding.id, authorUserId: ctx.user.id, status: 'published', ...values })
      .onConflictDoUpdate({ target: [review.vendorId, review.weddingId], set: { ...values, authorUserId: ctx.user.id } });
    return { ok: true };
  });

  app.delete<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/my-review', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    await db.delete(review).where(and(eq(review.vendorId, request.params.vendorId), eq(review.weddingId, ctx.wedding.id)));
    return { ok: true };
  });

  /** Vendor answers a review on their page. */
  app.put<{ Params: { id: string } }>('/api/vendors/me/reviews/:id/reply', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(reviewReplySchema, request.body, reply);
    if (!b) return;
    const [row] = await db
      .update(review)
      .set({ vendorReply: b.reply || null, vendorRepliedAt: b.reply ? new Date() : null })
      .where(and(eq(review.id, request.params.id), eq(review.vendorId, ctx.vendor.id)))
      .returning({ id: review.id });
    if (!row) return notFound(reply);
    return { ok: true };
  });

  // ===== community =====
  app.get('/api/community/me', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return { optIn: ctx.wedding.communityOptIn, bio: ctx.wedding.communityBio };
  });

  app.put('/api/community/me', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(communityProfileSchema, request.body, reply);
    if (!b) return;
    await db.update(wedding).set({ communityOptIn: b.optIn, communityBio: b.bio ?? null }).where(eq(wedding.id, ctx.wedding.id));
    return { optIn: b.optIn, bio: b.bio ?? null };
  });

  /** Couples who joined the community (not us), with what they booked through SOON. */
  app.get<{ Querystring: { q?: string } }>('/api/community', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const q = (request.query.q ?? '').trim().slice(0, 60);
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db.execute<{
      id: string;
      names: string;
      wedding_date: string | null;
      region: string | null;
      bio: string | null;
      booked: string[] | null;
      chat_id: string | null;
    }>(sql`
      select w.id, w.partner1_name || ' ו' || w.partner2_name as names, w.wedding_date::text as wedding_date, w.region,
        w.community_bio as bio,
        (select array_agg(distinct c.label_he) from lead l join vendor v on v.id = l.vendor_id join category c on c.slug = v.category_slug
          where l.wedding_id = w.id and l.status in ('booked', 'completed')) as booked,
        (select cc.id from couple_chat cc where (cc.wedding_a_id = w.id and cc.wedding_b_id = ${ctx.wedding.id})
          or (cc.wedding_b_id = w.id and cc.wedding_a_id = ${ctx.wedding.id})) as chat_id
      from wedding w
      where w.community_opt_in and w.id <> ${ctx.wedding.id}
        ${q ? sql`and (w.partner1_name ilike ${like} or w.partner2_name ilike ${like} or w.community_bio ilike ${like})` : sql``}
      order by w.wedding_date asc nulls last
      limit 100`);
    return rows.rows.map(
      (r): CommunityCoupleDTO => ({
        weddingId: r.id,
        names: r.names,
        weddingDate: r.wedding_date,
        region: r.region,
        bio: r.bio,
        bookedCategories: r.booked ?? [],
        chatId: r.chat_id,
      }),
    );
  });

  // ===== couple <-> couple chat =====
  app.get('/api/couple-chats', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return listChats(ctx.wedding.id, ctx.user.id);
  });

  /** Open (or reuse) a chat with a couple from the community. */
  app.post<{ Body: { weddingId?: string } }>('/api/couple-chats', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const otherId = request.body?.weddingId;
    if (!isUuid(otherId) || otherId === ctx.wedding.id) return badRequest(reply, 'Unknown couple', 'weddingId');
    const [other] = await db.select({ optIn: wedding.communityOptIn }).from(wedding).where(eq(wedding.id, otherId));
    if (!other?.optIn) return notFound(reply);
    const [a, b] = ctx.wedding.id < otherId ? [ctx.wedding.id, otherId] : [otherId, ctx.wedding.id];
    await db.insert(coupleChat).values({ weddingAId: a, weddingBId: b }).onConflictDoNothing();
    const [c] = await db
      .select({ id: coupleChat.id })
      .from(coupleChat)
      .where(and(eq(coupleChat.weddingAId, a), eq(coupleChat.weddingBId, b)));
    return reply.status(201).send({ chatId: c!.id });
  });

  app.get<{ Params: { id: string } }>('/api/couple-chats/:id', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [chat] = await listChats(ctx.wedding.id, ctx.user.id, request.params.id);
    if (!chat) return notFound(reply);
    const isA = await db.$count(coupleChat, and(eq(coupleChat.id, chat.id), eq(coupleChat.weddingAId, ctx.wedding.id)));
    const [msgs] = await Promise.all([
      db
        .select()
        .from(coupleChatMessage)
        .where(eq(coupleChatMessage.chatId, chat.id))
        .orderBy(desc(coupleChatMessage.createdAt))
        .limit(300),
      db
        .update(coupleChat)
        .set(isA ? { aReadAt: new Date() } : { bReadAt: new Date() })
        .where(eq(coupleChat.id, chat.id)),
    ]);
    const mine = new Set(
      (await db.select({ id: weddingMember.userId }).from(weddingMember).where(eq(weddingMember.weddingId, ctx.wedding.id))).map((m) => m.id),
    );
    const detail: CoupleChatDetail = {
      chat: { ...chat, unread: 0 },
      messages: msgs.reverse().map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), mine: mine.has(m.senderUserId) })),
    };
    return detail;
  });

  app.post<{ Params: { id: string } }>('/api/couple-chats/:id/messages', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(coupleMessageSchema, request.body, reply);
    if (!b) return;
    const [c] = await db
      .select()
      .from(coupleChat)
      .where(
        and(
          eq(coupleChat.id, request.params.id),
          or(eq(coupleChat.weddingAId, ctx.wedding.id), eq(coupleChat.weddingBId, ctx.wedding.id)),
        ),
      );
    if (!c) return notFound(reply);
    const now = new Date();
    const isA = c.weddingAId === ctx.wedding.id;
    await db.transaction(async (tx) => {
      await tx.insert(coupleChatMessage).values({ chatId: c.id, senderUserId: ctx.user.id, body: b.body, createdAt: now });
      await tx
        .update(coupleChat)
        .set({ lastMessageAt: now, ...(isA ? { aReadAt: now } : { bReadAt: now }) })
        .where(eq(coupleChat.id, c.id));
    });
    return reply.status(201).send({ ok: true });
  });
}
