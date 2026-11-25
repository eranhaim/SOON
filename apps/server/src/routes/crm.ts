/**
 * The vendor's business tools: leads/CRM (spec §10), client payments (§13), the business
 * calendar (§11) and the dashboard (§9). Calendar entries read client details from the lead
 * they link to — nothing is copied (spec §19).
 */
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';

import {
  ACTIVE_LEAD_STATUSES,
  addDays,
  calendarEntryInputSchema,
  calendarEntryUpdateSchema,
  CLOSED_LEAD_STATUSES,
  LEAD_STATUSES,
  leadCreateSchema,
  leadFromWeddingSchema,
  leadPaymentInputSchema,
  leadPaymentUpdateSchema,
  leadUpdateSchema,
  todayIso,
  type CalendarEntryDTO,
  type CoupleSearchItem,
  type LeadDetailDTO,
  type LeadListItem,
  type LeadsDTO,
  type LeadStatus,
  type VendorDashboardDTO,
} from '@soon/shared';

import { db } from '../db';
import {
  availabilityEntry,
  conversation,
  lead,
  leadPayment,
  message,
  review,
  savedVendor,
  vendor,
  vendorPackage,
  vendorStatDaily,
  wedding,
} from '../db/schema';
import { badRequest, conflict, isCheckViolation, isExclusionViolation, isUuid, notFound } from '../http';
import { parseBody, requireOwnVendor } from '../session';
import { dayBounds } from '../services/availability';
import { unreadTotal } from './conversations';
import { deleteCalendarEntry, syncCalendarEntry } from './google-calendar';

const BOOKED_CONFLICT = 'יש כבר אירוע סגור ביומן בזמן הזה';

// ---------- leads ----------

const clientNameSql = sql<string>`coalesce(${lead.clientName}, ${wedding.partner1Name} || ' ו' || ${wedding.partner2Name})`;

function unreadForVendorSql(ownerUserId: string) {
  return sql<number>`coalesce((select count(*)::int from ${message} m
    where m.conversation_id = ${conversation.id} and m.sender_user_id <> ${ownerUserId}
      and (${conversation.vendorReadAt} is null or m.created_at > ${conversation.vendorReadAt})), 0)`;
}

async function listLeads(vendorId: string, ownerUserId: string, where?: SQL): Promise<LeadListItem[]> {
  const rows = await db
    .select({
      l: lead,
      clientName: clientNameSql,
      conversationId: conversation.id,
      unread: unreadForVendorSql(ownerUserId),
    })
    .from(lead)
    .leftJoin(wedding, eq(wedding.id, lead.weddingId))
    .leftJoin(conversation, eq(conversation.leadId, lead.id))
    .where(and(eq(lead.vendorId, vendorId), where))
    .orderBy(desc(lead.updatedAt))
    .limit(500);
  return rows.map(({ l, clientName, conversationId, unread }) => ({
    id: l.id,
    clientName,
    source: l.source,
    status: l.status,
    eventDate: l.eventDate,
    location: l.location,
    guestCount: l.guestCount,
    quotedPriceAgorot: l.quotedPriceAgorot,
    nextAction: l.nextAction,
    nextActionAt: l.nextActionAt?.toISOString() ?? null,
    conversationId,
    unread,
    updatedAt: l.updatedAt.toISOString(),
  }));
}

// ---------- calendar ----------

const paidSql = sql<number>`coalesce((select sum(${leadPayment.amountAgorot})::int from ${leadPayment}
  where ${leadPayment.leadId} = ${availabilityEntry.leadId} and ${leadPayment.paidAt} is not null), 0)`;

export async function listEntries(vendorId: string, where?: SQL, limit = 1000): Promise<CalendarEntryDTO[]> {
  const rows = await db
    .select({
      e: availabilityEntry,
      clientName: sql<string | null>`case when ${lead.id} is null then null else ${clientNameSql} end`,
      clientPhone: lead.clientPhone,
      leadStatus: lead.status,
      quoted: lead.quotedPriceAgorot,
      paid: paidSql,
      coupleNames: sql<string | null>`case when ${wedding.id} is null then null else ${wedding.partner1Name} || ' ו' || ${wedding.partner2Name} end`,
    })
    .from(availabilityEntry)
    .leftJoin(lead, eq(lead.id, availabilityEntry.leadId))
    .leftJoin(wedding, eq(wedding.id, sql`coalesce(${availabilityEntry.weddingId}, ${lead.weddingId})`))
    .where(and(eq(availabilityEntry.vendorId, vendorId), where))
    .orderBy(asc(availabilityEntry.startsAt))
    .limit(limit);
  return rows.map(({ e, clientName, clientPhone, leadStatus, quoted, paid, coupleNames }) => ({
    id: e.id,
    status: e.status,
    kind: e.kind,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    title: e.title,
    location: e.location,
    note: e.note,
    leadId: e.leadId,
    clientName,
    clientPhone,
    leadStatus,
    quotedPriceAgorot: quoted,
    paidAgorot: paid,
    weddingId: e.weddingId,
    coupleNames,
    depositAgorot: e.depositAgorot,
  }));
}

/**
 * Lead for a registered couple: reuse the vendor's existing lead or create one (source: app).
 * Used when the vendor picks a couple from the search (calendar entry or "new client").
 */
async function leadForWedding(vendorId: string, weddingId: string): Promise<string | null> {
  const [w] = await db
    .select({ id: wedding.id, date: wedding.weddingDate, venue: wedding.venueName })
    .from(wedding)
    .where(eq(wedding.id, weddingId));
  if (!w) return null;
  const [row] = await db
    .insert(lead)
    .values({ vendorId, weddingId: w.id, source: 'manual', status: 'new', eventDate: w.date, location: w.venue })
    .onConflictDoUpdate({ target: [lead.vendorId, lead.weddingId], set: { updatedAt: new Date() } })
    .returning({ id: lead.id });
  return row!.id;
}

async function weddingOfLead(leadId: string): Promise<string | null> {
  const [l] = await db.select({ w: lead.weddingId }).from(lead).where(eq(lead.id, leadId));
  return l?.w ?? null;
}

async function loadLead(vendorId: string, ownerUserId: string, id: string): Promise<LeadDetailDTO | null> {
  const [item] = await listLeads(vendorId, ownerUserId, eq(lead.id, id));
  if (!item) return null;
  const [[row], payments, calendar] = await Promise.all([
    db
      .select({ l: lead, packageName: vendorPackage.name })
      .from(lead)
      .leftJoin(vendorPackage, eq(vendorPackage.id, lead.packageId))
      .where(eq(lead.id, id)),
    db.select().from(leadPayment).where(eq(leadPayment.leadId, id)).orderBy(sql`${leadPayment.dueDate} asc nulls last`),
    listEntries(vendorId, eq(availabilityEntry.leadId, id)),
  ]);
  return {
    ...item,
    clientPhone: row!.l.clientPhone,
    clientEmail: row!.l.clientEmail,
    notes: row!.l.notes,
    packageName: row!.packageName,
    weddingId: row!.l.weddingId,
    createdAt: row!.l.createdAt.toISOString(),
    payments: payments.map((p) => ({
      id: p.id,
      title: p.title,
      amountAgorot: p.amountAgorot,
      dueDate: p.dueDate,
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
    calendar,
  };
}

async function ownLead(vendorId: string, id: string) {
  if (!isUuid(id)) return null;
  const [row] = await db.select().from(lead).where(and(eq(lead.id, id), eq(lead.vendorId, vendorId)));
  return row ?? null;
}

/** Writes that may hit the no-double-booking constraint. */
async function calendarWrite(reply: FastifyReply, run: () => Promise<unknown>) {
  try {
    return await run();
  } catch (err) {
    if (isExclusionViolation(err)) return conflict(reply, BOOKED_CONFLICT);
    if (isCheckViolation(err)) return badRequest(reply, 'שעת הסיום לפני שעת ההתחלה', 'endsAt');
    throw err;
  }
}

export function icsEscape(s: string) {
  return s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}
export const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// ---------- routes ----------

export async function crmRoutes(app: FastifyInstance) {
  /**
   * Find a couple registered in SOON (to add as a client or link to a calendar entry).
   * Matches partner names, or an exact email / phone. Returns no contact details.
   */
  app.get<{ Querystring: { q?: string } }>('/api/couples/search', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const q = (request.query.q ?? '').trim().slice(0, 80);
    if (q.length < 2) return [];
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const digits = q.replace(/\D/g, '');
    const rows = await db.execute<{
      wedding_id: string;
      names: string;
      wedding_date: string | null;
      region: string | null;
      lead_id: string | null;
    }>(sql`
      select w.id as wedding_id, w.partner1_name || ' ו' || w.partner2_name as names,
        w.wedding_date::text as wedding_date, w.region,
        (select l.id from lead l where l.vendor_id = ${ctx.vendor.id} and l.wedding_id = w.id) as lead_id
      from wedding w
      where (
          (w.partner1_name ilike ${like} or w.partner2_name ilike ${like} or (w.partner1_name || ' ו' || w.partner2_name) ilike ${like})
          -- Names only find couples who already know this vendor, or who joined the community.
          and (w.community_opt_in
            or exists (select 1 from lead l where l.vendor_id = ${ctx.vendor.id} and l.wedding_id = w.id)
            or exists (select 1 from conversation c where c.vendor_id = ${ctx.vendor.id} and c.wedding_id = w.id))
        )
        -- Any couple by their exact email or phone (the vendor already has it).
        or exists (select 1 from wedding_member m join "user" u on u.id = m.user_id
          where m.wedding_id = w.id and (lower(u.email) = lower(${q})
            ${digits.length >= 9 ? sql`or regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') like ${`%${digits.slice(-9)}`}` : sql``}))
      order by w.wedding_date asc nulls last
      limit 15`);
    return rows.rows.map(
      (r): CoupleSearchItem => ({ weddingId: r.wedding_id, names: r.names, weddingDate: r.wedding_date, region: r.region, leadId: r.lead_id }),
    );
  });

  /** Add a registered couple as a client (or open the existing client card). */
  app.post('/api/leads/from-wedding', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(leadFromWeddingSchema, request.body, reply);
    if (!b) return;
    const id = await leadForWedding(ctx.vendor.id, b.weddingId);
    if (!id) return notFound(reply);
    return reply.status(201).send({ leadId: id });
  });

  // ----- leads -----
  app.get<{ Querystring: { status?: string; q?: string } }>('/api/leads', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const { status, q } = request.query;
    const where = and(
      (LEAD_STATUSES as readonly string[]).includes(status ?? '') ? eq(lead.status, status as LeadStatus) : undefined,
      q?.trim()
        ? or(ilike(clientNameSql, `%${q.trim()}%`), ilike(lead.clientPhone, `%${q.trim()}%`), ilike(lead.location, `%${q.trim()}%`))
        : undefined,
    );
    const [items, counts] = await Promise.all([
      listLeads(ctx.vendor.id, ctx.user.id, where),
      db.select({ status: lead.status, n: count() }).from(lead).where(eq(lead.vendorId, ctx.vendor.id)).groupBy(lead.status),
    ]);
    const result: LeadsDTO = { items, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) };
    return result;
  });

  /** A client who isn't in the app (spec §14.1). */
  app.post('/api/leads', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(leadCreateSchema, request.body, reply);
    if (!b) return;
    const [row] = await db
      .insert(lead)
      .values({
        vendorId: ctx.vendor.id,
        source: 'manual',
        clientName: b.clientName,
        clientPhone: b.clientPhone ?? null,
        clientEmail: b.clientEmail ?? null,
        eventDate: b.eventDate ?? null,
        location: b.location ?? null,
        guestCount: b.guestCount ?? null,
        quotedPriceAgorot: b.quotedPrice ?? null,
        notes: b.notes ?? null,
        nextAction: b.nextAction ?? null,
        nextActionAt: b.nextActionAt ? new Date(b.nextActionAt) : null,
      })
      .returning({ id: lead.id });
    return reply.status(201).send(await loadLead(ctx.vendor.id, ctx.user.id, row!.id));
  });

  app.get<{ Params: { id: string } }>('/api/leads/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const detail = await loadLead(ctx.vendor.id, ctx.user.id, request.params.id);
    return detail ?? notFound(reply);
  });

  /**
   * Update a lead. Moving to "booked" returns `suggestCalendar` when the lead has no booked
   * slot yet — the app then offers a prefilled "add to calendar" (spec §11); nothing is created
   * without the vendor's confirmation.
   */
  app.patch<{ Params: { id: string } }>('/api/leads/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const current = await ownLead(ctx.vendor.id, request.params.id);
    if (!current) return notFound(reply);
    const b = await parseBody(leadUpdateSchema, request.body, reply);
    if (!b) return;
    if (current.weddingId && (b.clientName !== undefined || b.clientEmail !== undefined)) {
      return badRequest(reply, 'פרטי זוג רשום מתעדכנים מהפרופיל שלו');
    }
    const set: Partial<typeof lead.$inferInsert> = {};
    if (b.status !== undefined) set.status = b.status;
    // First time the deal closes: stamp it for the weekly "deals" statistic.
    if (b.status === 'booked' && !current.bookedAt) set.bookedAt = new Date();
    if (b.clientName !== undefined) set.clientName = b.clientName;
    if (b.clientPhone !== undefined) set.clientPhone = b.clientPhone;
    if (b.clientEmail !== undefined) set.clientEmail = b.clientEmail;
    if (b.eventDate !== undefined) set.eventDate = b.eventDate;
    if (b.location !== undefined) set.location = b.location;
    if (b.guestCount !== undefined) set.guestCount = b.guestCount;
    if (b.quotedPrice !== undefined) set.quotedPriceAgorot = b.quotedPrice;
    if (b.notes !== undefined) set.notes = b.notes;
    if (b.nextAction !== undefined) set.nextAction = b.nextAction;
    if (b.nextActionAt !== undefined) set.nextActionAt = b.nextActionAt ? new Date(b.nextActionAt) : null;
    if (Object.keys(set).length) await db.update(lead).set(set).where(eq(lead.id, current.id));

    const detail = await loadLead(ctx.vendor.id, ctx.user.id, current.id);
    const becameBooked = b.status === 'booked' && current.status !== 'booked';
    const suggestCalendar = becameBooked && !detail!.calendar.some((e) => e.status === 'booked');
    return { ...detail, suggestCalendar };
  });

  app.delete<{ Params: { id: string } }>('/api/leads/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const current = await ownLead(ctx.vendor.id, request.params.id);
    if (!current) return notFound(reply);
    // Leads from couples in the app are part of a shared thread: close them, don't delete.
    if (current.source === 'app') return badRequest(reply, 'פנייה מזוג באפליקציה אפשר לסמן כלא רלוונטית, לא למחוק');
    await db.delete(lead).where(eq(lead.id, current.id));
    return { ok: true };
  });

  // ----- client payments -----
  app.post<{ Params: { id: string } }>('/api/leads/:id/payments', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const current = await ownLead(ctx.vendor.id, request.params.id);
    if (!current) return notFound(reply);
    const b = await parseBody(leadPaymentInputSchema, request.body, reply);
    if (!b) return;
    await db.insert(leadPayment).values({
      leadId: current.id,
      title: b.title,
      amountAgorot: b.amount,
      dueDate: b.dueDate ?? null,
      paidAt: b.paid ? new Date() : null,
    });
    return reply.status(201).send(await loadLead(ctx.vendor.id, ctx.user.id, current.id));
  });

  app.patch<{ Params: { id: string; pid: string } }>('/api/leads/:id/payments/:pid', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const current = await ownLead(ctx.vendor.id, request.params.id);
    if (!current || !isUuid(request.params.pid)) return notFound(reply);
    const b = await parseBody(leadPaymentUpdateSchema, request.body, reply);
    if (!b) return;
    const set: Partial<typeof leadPayment.$inferInsert> = {};
    if (b.title !== undefined) set.title = b.title;
    if (b.amount !== undefined) set.amountAgorot = b.amount;
    if (b.dueDate !== undefined) set.dueDate = b.dueDate;
    if (b.paid !== undefined) set.paidAt = b.paid ? new Date() : null;
    const [row] = await db
      .update(leadPayment)
      .set(set)
      .where(and(eq(leadPayment.id, request.params.pid), eq(leadPayment.leadId, current.id)))
      .returning({ id: leadPayment.id });
    if (!row) return notFound(reply);
    return loadLead(ctx.vendor.id, ctx.user.id, current.id);
  });

  app.delete<{ Params: { id: string; pid: string } }>('/api/leads/:id/payments/:pid', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const current = await ownLead(ctx.vendor.id, request.params.id);
    if (!current || !isUuid(request.params.pid)) return notFound(reply);
    await db.delete(leadPayment).where(and(eq(leadPayment.id, request.params.pid), eq(leadPayment.leadId, current.id)));
    return loadLead(ctx.vendor.id, ctx.user.id, current.id);
  });

  // ----- calendar -----
  app.get<{ Querystring: { from?: string; to?: string } }>('/api/calendar', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const from = iso.test(request.query.from ?? '') ? request.query.from! : addDays(todayIso(), -40);
    const to = iso.test(request.query.to ?? '') ? request.query.to! : addDays(todayIso(), 400);
    return listEntries(
      ctx.vendor.id,
      and(lt(availabilityEntry.startsAt, dayBounds(to).end), gte(availabilityEntry.endsAt, dayBounds(from).start)),
    );
  });

  app.post('/api/calendar', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(calendarEntryInputSchema, request.body, reply);
    if (!b) return;
    if (b.leadId && !(await ownLead(ctx.vendor.id, b.leadId))) return badRequest(reply, 'Unknown lead', 'leadId');
    // Picking a registered couple links (or creates) their lead, so the entry shows under the client too.
    let leadId = b.leadId ?? null;
    if (b.weddingId && !leadId) {
      leadId = await leadForWedding(ctx.vendor.id, b.weddingId);
      if (!leadId) return badRequest(reply, 'Unknown couple', 'weddingId');
    }
    const weddingId = b.weddingId ?? (leadId ? await weddingOfLead(leadId) : null);
    return calendarWrite(reply, async () => {
      const [row] = await db
        .insert(availabilityEntry)
        .values({
          vendorId: ctx.vendor.id,
          status: b.status,
          kind: b.kind,
          startsAt: new Date(b.startsAt),
          endsAt: new Date(b.endsAt),
          title: b.title ?? null,
          location: b.location ?? null,
          note: b.note ?? null,
          leadId,
          weddingId,
          depositAgorot: b.deposit ?? null,
        })
        .returning({ id: availabilityEntry.id });
      void syncCalendarEntry(ctx.vendor.id, row!.id, request.log);
      const [entry] = await listEntries(ctx.vendor.id, eq(availabilityEntry.id, row!.id));
      return reply.status(201).send(entry);
    });
  });

  app.patch<{ Params: { id: string } }>('/api/calendar/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(calendarEntryUpdateSchema, request.body, reply);
    if (!b) return;
    if (b.leadId && !(await ownLead(ctx.vendor.id, b.leadId))) return badRequest(reply, 'Unknown lead', 'leadId');
    const set: Partial<typeof availabilityEntry.$inferInsert> = {};
    if (b.status !== undefined) set.status = b.status;
    if (b.kind !== undefined) set.kind = b.kind;
    if (b.startsAt !== undefined) set.startsAt = new Date(b.startsAt);
    if (b.endsAt !== undefined) set.endsAt = new Date(b.endsAt);
    if (b.title !== undefined) set.title = b.title;
    if (b.location !== undefined) set.location = b.location;
    if (b.note !== undefined) set.note = b.note;
    if (b.leadId !== undefined) {
      set.leadId = b.leadId;
      if (b.weddingId === undefined) set.weddingId = b.leadId ? await weddingOfLead(b.leadId) : null;
    }
    if (b.weddingId !== undefined) {
      set.weddingId = b.weddingId;
      if (b.weddingId && !b.leadId) {
        const l = await leadForWedding(ctx.vendor.id, b.weddingId);
        if (!l) return badRequest(reply, 'Unknown couple', 'weddingId');
        set.leadId = l;
      }
    }
    if (b.deposit !== undefined) set.depositAgorot = b.deposit;
    return calendarWrite(reply, async () => {
      const [row] = await db
        .update(availabilityEntry)
        .set(set)
        .where(and(eq(availabilityEntry.id, request.params.id), eq(availabilityEntry.vendorId, ctx.vendor.id)))
        .returning({ id: availabilityEntry.id });
      if (!row) return notFound(reply);
      void syncCalendarEntry(ctx.vendor.id, row.id, request.log);
      const [entry] = await listEntries(ctx.vendor.id, eq(availabilityEntry.id, row.id));
      return entry;
    });
  });

  app.delete<{ Params: { id: string } }>('/api/calendar/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [row] = await db
      .delete(availabilityEntry)
      .where(and(eq(availabilityEntry.id, request.params.id), eq(availabilityEntry.vendorId, ctx.vendor.id)))
      .returning({ id: availabilityEntry.id });
    if (row) void deleteCalendarEntry(ctx.vendor.id, row.id, request.log);
    return row ? { ok: true } : notFound(reply);
  });

  /** One-way export to Google / Apple Calendar as an .ics file (spec §11). */
  app.get<{ Params: { id: string } }>('/api/calendar/:id/ics', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [e] = await listEntries(ctx.vendor.id, eq(availabilityEntry.id, request.params.id));
    if (!e) return notFound(reply);
    const summary = e.title ?? e.clientName ?? 'SOON';
    const description = [e.clientName, e.clientPhone, e.note].filter(Boolean).join('\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SOON//Calendar//HE',
      'BEGIN:VEVENT',
      `UID:${e.id}@soon`,
      `DTSTAMP:${icsTime(new Date())}`,
      `DTSTART:${icsTime(new Date(e.startsAt))}`,
      `DTEND:${icsTime(new Date(e.endsAt))}`,
      `SUMMARY:${icsEscape(summary)}`,
      e.location ? `LOCATION:${icsEscape(e.location)}` : '',
      description ? `DESCRIPTION:${icsEscape(description)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="soon-${e.id.slice(0, 8)}.ics"`)
      .send(ics);
  });

  // ----- dashboard (spec §9) -----
  app.get('/api/vendors/me/dashboard', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const vid = ctx.vendor.id;
    const today = todayIso();
    const now = new Date();
    const yearStart = `${today.slice(0, 4)}-01-01`;

    const [[leadStats], [views], series, [saves], [revenue], [collected], [rating], upcoming, followUps, unread] = await Promise.all([
      db
        .select({
          newLeads: sql<number>`count(*) filter (where ${lead.status} = 'new')::int`,
          active: sql<number>`count(*) filter (where ${inArray(lead.status, ACTIVE_LEAD_STATUSES)})::int`,
        })
        .from(lead)
        .where(eq(lead.vendorId, vid)),
      db
        .select({
          d30: sql<number>`coalesce(sum(${vendorStatDaily.views}) filter (where ${vendorStatDaily.day} > ${addDays(today, -30)}), 0)::int`,
          d7: sql<number>`coalesce(sum(${vendorStatDaily.views}) filter (where ${vendorStatDaily.day} > ${addDays(today, -7)}), 0)::int`,
        })
        .from(vendorStatDaily)
        .where(eq(vendorStatDaily.vendorId, vid)),
      db
        .select({ day: vendorStatDaily.day, views: vendorStatDaily.views })
        .from(vendorStatDaily)
        .where(and(eq(vendorStatDaily.vendorId, vid), gte(vendorStatDaily.day, addDays(today, -29))))
        .orderBy(asc(vendorStatDaily.day)),
      db.select({ n: count() }).from(savedVendor).where(eq(savedVendor.vendorId, vid)),
      db
        .select({ v: sql<number>`coalesce(sum(${lead.quotedPriceAgorot}), 0)::int` })
        .from(lead)
        .where(and(eq(lead.vendorId, vid), inArray(lead.status, CLOSED_LEAD_STATUSES), gte(lead.eventDate, yearStart))),
      db
        .select({ v: sql<number>`coalesce(sum(${leadPayment.amountAgorot}), 0)::int` })
        .from(leadPayment)
        .innerJoin(lead, eq(lead.id, leadPayment.leadId))
        .where(and(eq(lead.vendorId, vid), isNotNull(leadPayment.paidAt))),
      db
        .select({ avg: sql<number | null>`round(avg(${review.rating})::numeric, 1)`, n: count() })
        .from(review)
        .where(and(eq(review.vendorId, vid), eq(review.status, 'published'))),
      listEntries(vid, and(gte(availabilityEntry.endsAt, now), inArray(availabilityEntry.status, ['booked', 'pending'])), 6),
      listLeads(
        vid,
        ctx.user.id,
        and(isNotNull(lead.nextActionAt), lt(lead.nextActionAt, new Date(now.getTime() + 3 * 86_400_000)), inArray(lead.status, ACTIVE_LEAD_STATUSES)),
      ),
      unreadTotal({ side: 'vendor', vendorId: vid }, ctx.user.id),
    ]);

    const [booked] = await db
      .select({
        upcomingEvents: sql<number>`count(*) filter (where ${availabilityEntry.kind} = 'event')::int`,
        dates: sql<number>`count(distinct (${availabilityEntry.startsAt} at time zone 'Asia/Jerusalem')::date)::int`,
      })
      .from(availabilityEntry)
      .where(and(eq(availabilityEntry.vendorId, vid), eq(availabilityEntry.status, 'booked'), gte(availabilityEntry.endsAt, now)));

    const dto: VendorDashboardDTO = {
      newLeads: leadStats?.newLeads ?? 0,
      activeClients: leadStats?.active ?? 0,
      upcomingEvents: booked?.upcomingEvents ?? 0,
      bookedDates: booked?.dates ?? 0,
      unreadMessages: unread,
      views30: views?.d30 ?? 0,
      views7: views?.d7 ?? 0,
      saves: Number(saves?.n ?? 0),
      bookedRevenueAgorot: revenue?.v ?? 0,
      collectedAgorot: collected?.v ?? 0,
      reviewAvg: rating?.avg == null ? null : Number(rating.avg),
      reviewCount: Number(rating?.n ?? 0),
      upcoming,
      followUps: followUps.sort((a, b) => (a.nextActionAt ?? '').localeCompare(b.nextActionAt ?? '')).slice(0, 5),
      viewsSeries: series,
    };
    return dto;
  });
}
