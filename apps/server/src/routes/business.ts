/**
 * Vendor business management (round 2): statistics, finances (income / expenses),
 * client documents, subscription plan, settings and the private calendar feed.
 */
import { randomBytes } from 'node:crypto';

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import {
  addDays,
  CLOSED_LEAD_STATUSES,
  DEFAULT_VENDOR_SETTINGS,
  documentInputSchema,
  expenseInputSchema,
  PLANS,
  todayIso,
  vendorSettingsSchema,
  type ClientDocumentDTO,
  type ExpenseDTO,
  type FinanceDTO,
  type FinancePayment,
  type ReviewDTO,
  type VendorAccountDTO,
  type VendorSettings,
  type VendorStatsDTO,
  type VendorWeekStat,
} from '@soon/shared';

import { db } from '../db';
import { availabilityEntry, clientDocument, lead, leadPayment, review, savedVendor, vendor, vendorExpense, vendorStatDaily, wedding } from '../db/schema';
import { env } from '../env';
import { badRequest, isUniqueViolation, isUuid, notFound } from '../http';
import { parseBody, requireOwnVendor } from '../session';
import { icsEscape, icsTime, listEntries } from './crm';

type VendorRow = typeof vendor.$inferSelect;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
/** "Client" label for a lead: the typed name, or the registered couple's names. */
const clientNameSql = sql<string>`coalesce(${lead.clientName}, ${wedding.partner1Name} || ' ו' || ${wedding.partner2Name}, 'לקוח')`;

function settingsOf(v: VendorRow): VendorSettings {
  const s = v.settings ?? {};
  return {
    ...DEFAULT_VENDOR_SETTINGS,
    ...s,
    notifications: { ...DEFAULT_VENDOR_SETTINGS.notifications, ...(s.notifications ?? {}) },
  };
}

async function ensureCalendarToken(v: VendorRow) {
  if (v.calendarToken) return v.calendarToken;
  const token = randomBytes(18).toString('base64url');
  await db.update(vendor).set({ calendarToken: token }).where(eq(vendor.id, v.id));
  return token;
}

const feedUrl = (token: string) => `${env.BETTER_AUTH_URL.replace(/\/$/, '')}/api/calendar/feed/${token}.ics`;

async function accountOf(v: VendorRow): Promise<VendorAccountDTO> {
  return {
    plan: (PLANS.some((p) => p.key === v.plan) ? v.plan : 'basic') as VendorAccountDTO['plan'],
    planSince: v.planSince?.toISOString() ?? null,
    settings: settingsOf(v),
    taxId: v.taxId,
    businessAddress: v.businessAddress,
    calendarFeedUrl: feedUrl(await ensureCalendarToken(v)),
  };
}

/** Sunday of the week that contains `iso`. */
function weekStartOf(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -d.getUTCDay());
}

async function loadStats(vendorId: string, weeks: number): Promise<VendorStatsDTO> {
  const thisWeek = weekStartOf(todayIso());
  const first = addDays(thisWeek, -7 * (weeks - 1));
  const firstInstant = new Date(`${first}T00:00:00+02:00`);
  // Week bucket (Sunday) for a date / for an instant in Israel time.
  const weekOfDate = (col: unknown) => sql<string>`to_char(${col} - extract(dow from ${col})::int, 'YYYY-MM-DD')`;
  const localDate = (col: unknown) => sql`(${col} at time zone 'Asia/Jerusalem')::date`;

  const [views, saves, inquiries, deals] = await Promise.all([
    db
      .select({ week: weekOfDate(vendorStatDaily.day), n: sql<number>`sum(${vendorStatDaily.views})::int` })
      .from(vendorStatDaily)
      .where(and(eq(vendorStatDaily.vendorId, vendorId), gte(vendorStatDaily.day, first)))
      .groupBy(sql`1`),
    db
      .select({ week: weekOfDate(localDate(savedVendor.createdAt)), n: sql<number>`count(*)::int` })
      .from(savedVendor)
      .where(and(eq(savedVendor.vendorId, vendorId), gte(savedVendor.createdAt, firstInstant)))
      .groupBy(sql`1`),
    db
      .select({ week: weekOfDate(localDate(lead.createdAt)), n: sql<number>`count(*)::int` })
      .from(lead)
      .where(and(eq(lead.vendorId, vendorId), gte(lead.createdAt, firstInstant)))
      .groupBy(sql`1`),
    db
      .select({ week: weekOfDate(localDate(lead.bookedAt)), n: sql<number>`count(*)::int` })
      .from(lead)
      .where(and(eq(lead.vendorId, vendorId), isNotNull(lead.bookedAt), gte(lead.bookedAt, firstInstant)))
      .groupBy(sql`1`),
  ]);
  const map = (rows: { week: string; n: number }[]) => new Map(rows.map((r) => [r.week, r.n]));
  const [v, s, i, d] = [map(views), map(saves), map(inquiries), map(deals)];
  const list: VendorWeekStat[] = Array.from({ length: weeks }, (_, k) => {
    const weekStart = addDays(first, 7 * k);
    return { weekStart, views: v.get(weekStart) ?? 0, saves: s.get(weekStart) ?? 0, inquiries: i.get(weekStart) ?? 0, deals: d.get(weekStart) ?? 0 };
  });
  const totals = list.reduce(
    (a, w) => ({ views: a.views + w.views, saves: a.saves + w.saves, inquiries: a.inquiries + w.inquiries, deals: a.deals + w.deals }),
    { views: 0, saves: 0, inquiries: 0, deals: 0 },
  );
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return { weeks: list, totals, viewToInquiry: pct(totals.inquiries, totals.views), inquiryToDeal: pct(totals.deals, totals.inquiries) };
}

async function loadFinance(vendorId: string, from: string, to: string): Promise<FinanceDTO> {
  const fromInstant = new Date(`${from}T00:00:00+02:00`);
  const toInstant = new Date(`${addDays(to, 1)}T00:00:00+02:00`);
  const payments = await db
    .select({
      id: leadPayment.id,
      leadId: lead.id,
      clientName: clientNameSql,
      eventDate: lead.eventDate,
      title: leadPayment.title,
      amountAgorot: leadPayment.amountAgorot,
      dueDate: leadPayment.dueDate,
      paidAt: leadPayment.paidAt,
    })
    .from(leadPayment)
    .innerJoin(lead, eq(lead.id, leadPayment.leadId))
    .leftJoin(wedding, eq(wedding.id, lead.weddingId))
    .where(eq(lead.vendorId, vendorId))
    .orderBy(asc(leadPayment.dueDate));
  const asDto = (p: (typeof payments)[number]): FinancePayment => ({ ...p, paidAt: p.paidAt?.toISOString() ?? null });

  const paidIn = payments.filter((p) => p.paidAt && p.paidAt >= fromInstant && p.paidAt < toInstant);
  const openIn = payments.filter((p) => !p.paidAt && (p.dueDate == null || (p.dueDate >= from && p.dueDate <= to)));
  const expenses = await db
    .select({ amount: vendorExpense.amountAgorot, spentOn: vendorExpense.spentOn })
    .from(vendorExpense)
    .where(and(eq(vendorExpense.vendorId, vendorId), gte(vendorExpense.spentOn, from), lte(vendorExpense.spentOn, to)));

  // Month buckets across the period.
  const months: FinanceDTO['months'] = [];
  for (let m = from.slice(0, 7); m <= to.slice(0, 7); ) {
    months.push({ month: m, collected: 0, expected: 0, expenses: 0 });
    const [y, mm] = m.split('-').map(Number) as [number, number];
    m = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, '0')}`;
  }
  const bucket = (iso: string) => months.find((x) => x.month === iso.slice(0, 7));
  const israelDay = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);
  for (const p of paidIn) bucket(israelDay(p.paidAt!))!.collected += p.amountAgorot;
  for (const p of openIn) if (p.dueDate) bucket(p.dueDate)!.expected += p.amountAgorot;
  for (const e of expenses) bucket(e.spentOn)!.expenses += e.amount;

  const deals = await db
    .select({
      leadId: lead.id,
      clientName: clientNameSql,
      eventDate: lead.eventDate,
      totalAgorot: sql<number>`coalesce(${lead.quotedPriceAgorot}, 0)::int`,
      paidAgorot: sql<number>`coalesce((select sum(lp.amount_agorot) from lead_payment lp where lp.lead_id = ${lead.id} and lp.paid_at is not null), 0)::int`,
    })
    .from(lead)
    .leftJoin(wedding, eq(wedding.id, lead.weddingId))
    .where(and(eq(lead.vendorId, vendorId), inArray(lead.status, CLOSED_LEAD_STATUSES)))
    .orderBy(asc(lead.eventDate));
  const inPeriod = deals.filter((d) => d.eventDate && d.eventDate >= from && d.eventDate <= to);

  return {
    from,
    to,
    collectedAgorot: paidIn.reduce((a, p) => a + p.amountAgorot, 0),
    // Everything still owed, whatever its due date ("how much is yet to come in").
    expectedAgorot: payments.filter((p) => !p.paidAt).reduce((a, p) => a + p.amountAgorot, 0),
    expensesAgorot: expenses.reduce((a, e) => a + e.amount, 0),
    bookedValueAgorot: inPeriod.reduce((a, d) => a + d.totalAgorot, 0),
    openBalanceAgorot: inPeriod.reduce((a, d) => a + Math.max(0, d.totalAgorot - d.paidAgorot), 0),
    months,
    deposits: paidIn.map(asDto).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    upcoming: payments.filter((p) => !p.paidAt).map(asDto),
    balances: deals.filter((d) => d.totalAgorot > d.paidAgorot),
  };
}

const toExpense = (r: typeof vendorExpense.$inferSelect): ExpenseDTO => ({
  id: r.id,
  title: r.title,
  amountAgorot: r.amountAgorot,
  spentOn: r.spentOn,
  category: r.category as ExpenseDTO['category'],
  receiptUrl: r.receiptUrl,
  note: r.note,
});

const toDocument = (r: typeof clientDocument.$inferSelect, v: VendorRow): ClientDocumentDTO => ({
  id: r.id,
  kind: r.kind as ClientDocumentDTO['kind'],
  number: r.number,
  issuedOn: r.issuedOn,
  leadId: r.leadId,
  clientName: r.clientName,
  clientPhone: r.clientPhone,
  clientEmail: r.clientEmail,
  description: r.description,
  amountAgorot: r.amountAgorot,
  paymentMethod: r.paymentMethod as ClientDocumentDTO['paymentMethod'],
  issuer: { businessName: v.businessName, taxId: v.taxId, address: v.businessAddress, phone: v.phone, email: v.email },
  createdAt: r.createdAt.toISOString(),
});

function period(q: { from?: string; to?: string }) {
  const today = todayIso();
  const from = isoDate.test(q.from ?? '') ? q.from! : `${today.slice(0, 4)}-01-01`;
  const to = isoDate.test(q.to ?? '') ? q.to! : `${today.slice(0, 4)}-12-31`;
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function businessRoutes(app: FastifyInstance) {
  // ----- reviews (public read) -----
  app.get<{ Params: { slug: string } }>('/api/vendors/:slug/reviews', async (request, reply) => {
    const [v] = await db.select({ id: vendor.id }).from(vendor).where(eq(vendor.slug, request.params.slug));
    if (!v) return notFound(reply);
    const rows = await db
      .select({
        id: review.id,
        rating: review.rating,
        body: review.body,
        author: sql<string>`${wedding.partner1Name} || ' ו' || ${wedding.partner2Name}`,
        weddingDate: wedding.weddingDate,
        verified: review.verified,
        vendorReply: review.vendorReply,
        createdAt: review.createdAt,
      })
      .from(review)
      .innerJoin(wedding, eq(wedding.id, review.weddingId))
      .where(and(eq(review.vendorId, v.id), eq(review.status, 'published')))
      .orderBy(desc(review.createdAt))
      .limit(20);
    return rows.map((r): ReviewDTO => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });

  // ----- statistics -----
  app.get<{ Querystring: { weeks?: string } }>('/api/vendors/me/stats', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const weeks = Math.min(52, Math.max(4, Number(request.query.weeks) || 12));
    return loadStats(ctx.vendor.id, weeks);
  });

  // ----- income -----
  app.get<{ Querystring: { from?: string; to?: string } }>('/api/vendors/me/finance', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const { from, to } = period(request.query);
    return loadFinance(ctx.vendor.id, from, to);
  });

  // ----- expenses -----
  app.get<{ Querystring: { from?: string; to?: string } }>('/api/vendors/me/expenses', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const { from, to } = period(request.query);
    const rows = await db
      .select()
      .from(vendorExpense)
      .where(and(eq(vendorExpense.vendorId, ctx.vendor.id), gte(vendorExpense.spentOn, from), lte(vendorExpense.spentOn, to)))
      .orderBy(desc(vendorExpense.spentOn), desc(vendorExpense.createdAt));
    return rows.map(toExpense);
  });

  app.post('/api/vendors/me/expenses', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(expenseInputSchema, request.body, reply);
    if (!b) return;
    const [row] = await db
      .insert(vendorExpense)
      .values({
        vendorId: ctx.vendor.id,
        title: b.title,
        amountAgorot: b.amount,
        spentOn: b.spentOn,
        category: b.category,
        receiptUrl: b.receiptUrl ?? null,
        note: b.note ?? null,
      })
      .returning();
    return reply.status(201).send(toExpense(row!));
  });

  app.patch<{ Params: { id: string } }>('/api/vendors/me/expenses/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(expenseInputSchema.partial(), request.body, reply);
    if (!b) return;
    const set: Partial<typeof vendorExpense.$inferInsert> = {};
    if (b.title !== undefined) set.title = b.title;
    if (b.amount !== undefined) set.amountAgorot = b.amount;
    if (b.spentOn !== undefined) set.spentOn = b.spentOn;
    if (b.category !== undefined) set.category = b.category;
    if (b.receiptUrl !== undefined) set.receiptUrl = b.receiptUrl;
    if (b.note !== undefined) set.note = b.note;
    const [row] = await db
      .update(vendorExpense)
      .set(set)
      .where(and(eq(vendorExpense.id, request.params.id), eq(vendorExpense.vendorId, ctx.vendor.id)))
      .returning();
    return row ? toExpense(row) : notFound(reply);
  });

  app.delete<{ Params: { id: string } }>('/api/vendors/me/expenses/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    await db.delete(vendorExpense).where(and(eq(vendorExpense.id, request.params.id), eq(vendorExpense.vendorId, ctx.vendor.id)));
    return { ok: true };
  });

  // ----- client documents (income side) -----
  app.get('/api/vendors/me/documents', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const rows = await db
      .select()
      .from(clientDocument)
      .where(eq(clientDocument.vendorId, ctx.vendor.id))
      .orderBy(desc(clientDocument.issuedOn), desc(clientDocument.number));
    return rows.map((r) => toDocument(r, ctx.vendor));
  });

  app.get<{ Params: { id: string } }>('/api/vendors/me/documents/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [row] = await db
      .select()
      .from(clientDocument)
      .where(and(eq(clientDocument.id, request.params.id), eq(clientDocument.vendorId, ctx.vendor.id)));
    return row ? toDocument(row, ctx.vendor) : notFound(reply);
  });

  /** Issue a document. Numbers run per vendor and kind; never edited afterwards. */
  app.post('/api/vendors/me/documents', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(documentInputSchema, request.body, reply);
    if (!b) return;
    if (b.leadId) {
      const ok = await db.$count(lead, and(eq(lead.id, b.leadId), eq(lead.vendorId, ctx.vendor.id)));
      if (!ok) return badRequest(reply, 'Unknown client', 'leadId');
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [row] = await db
          .insert(clientDocument)
          .values({
            vendorId: ctx.vendor.id,
            kind: b.kind,
            number: sql`coalesce((select max(cd.number) from client_document cd where cd.vendor_id = ${ctx.vendor.id} and cd.kind = ${b.kind}), 0) + 1`,
            issuedOn: b.issuedOn,
            leadId: b.leadId ?? null,
            clientName: b.clientName,
            clientPhone: b.clientPhone ?? null,
            clientEmail: b.clientEmail ?? null,
            description: b.description,
            amountAgorot: b.amount,
            paymentMethod: b.paymentMethod ?? null,
          })
          .returning();
        return reply.status(201).send(toDocument(row!, ctx.vendor));
      } catch (err) {
        if (!isUniqueViolation(err)) throw err; // two documents at once: take the next number
      }
    }
    return reply.status(409).send({ error: 'נסו שוב' });
  });

  // ----- account: plan, settings, invoice details, calendar feed -----
  app.get('/api/vendors/me/account', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    return accountOf(ctx.vendor);
  });

  app.patch('/api/vendors/me/settings', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(vendorSettingsSchema, request.body, reply);
    if (!b) return;
    const current = settingsOf(ctx.vendor);
    const settings: VendorSettings = {
      ...current,
      ...(b.autoLeadFromInquiry !== undefined ? { autoLeadFromInquiry: b.autoLeadFromInquiry } : {}),
      ...(b.language ? { language: b.language } : {}),
      notifications: { ...current.notifications, ...(b.notifications ?? {}) } as VendorSettings['notifications'],
    };
    const [row] = await db
      .update(vendor)
      .set({
        settings,
        ...(b.taxId !== undefined ? { taxId: b.taxId || null } : {}),
        ...(b.businessAddress !== undefined ? { businessAddress: b.businessAddress || null } : {}),
      })
      .where(eq(vendor.id, ctx.vendor.id))
      .returning();
    return accountOf(row!);
  });

  /** Change plan. Billing isn't connected yet, so the change applies at once. */
  app.put('/api/vendors/me/plan', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(z.object({ plan: z.enum(['basic', 'pro', 'premium']) }), request.body, reply);
    if (!b) return;
    const [row] = await db
      .update(vendor)
      .set({ plan: b.plan, planSince: new Date() })
      .where(eq(vendor.id, ctx.vendor.id))
      .returning();
    return accountOf(row!);
  });

  /** New secret feed address (the old one stops working everywhere). */
  app.post('/api/vendors/me/calendar-token', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const [row] = await db
      .update(vendor)
      .set({ calendarToken: randomBytes(18).toString('base64url') })
      .where(eq(vendor.id, ctx.vendor.id))
      .returning();
    return accountOf(row!);
  });

  /**
   * Private ICS feed for Google Calendar / Apple Calendar subscriptions. Stable UIDs, so the
   * calendar app updates events in place instead of creating duplicates.
   */
  app.get<{ Params: { file: string } }>('/api/calendar/feed/:file', async (request, reply) => {
    const token = request.params.file.replace(/\.ics$/, '');
    if (!/^[\w-]{16,64}$/.test(token)) return notFound(reply);
    const [v] = await db.select().from(vendor).where(eq(vendor.calendarToken, token));
    if (!v) return notFound(reply);
    const since = new Date(Date.now() - 90 * 86_400_000);
    const entries = await listEntries(v.id, and(gte(availabilityEntry.endsAt, since), ne(availabilityEntry.status, 'available')));
    const now = icsTime(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SOON//Vendor calendar//HE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${icsEscape(`SOON · ${v.businessName}`)}`,
      'X-WR-TIMEZONE:Asia/Jerusalem',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
    ];
    for (const e of entries) {
      const name = e.title ?? e.clientName ?? (e.status === 'unavailable' ? 'לא זמין' : 'אירוע');
      const prefix = e.status === 'pending' ? 'ממתין · ' : '';
      const description = [e.clientName, e.clientPhone, e.note].filter(Boolean).join('\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${e.id}@soon`,
        `DTSTAMP:${now}`,
        `DTSTART:${icsTime(new Date(e.startsAt))}`,
        `DTEND:${icsTime(new Date(e.endsAt))}`,
        `SUMMARY:${icsEscape(prefix + name)}`,
        e.location ? `LOCATION:${icsEscape(e.location)}` : '',
        description ? `DESCRIPTION:${icsEscape(description)}` : '',
        `STATUS:${e.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'}`,
        e.status === 'unavailable' ? 'TRANSP:OPAQUE' : '',
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Cache-Control', 'private, max-age=300')
      .send(lines.filter(Boolean).join('\r\n'));
  });
}

