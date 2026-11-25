/**
 * Couple planning (spec §7): checklist, budget + payments, guest list, wedding calendar.
 * Everything belongs to the wedding, so both partners share one copy (spec §19).
 */
import { and, asc, count, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import {
  budgetItemInputSchema,
  budgetItemUpdateSchema,
  CALENDAR_ENTRY_KIND_LABELS,
  guestBulkSchema,
  guestInputSchema,
  guestUpdateSchema,
  RSVP_STATUSES,
  taskInputSchema,
  taskUpdateSchema,
  weddingEventInputSchema,
  weddingEventUpdateSchema,
  weddingPaymentInputSchema,
  weddingPaymentUpdateSchema,
  type BudgetDTO,
  type GuestDTO,
  type GuestListDTO,
  type TaskDTO,
  type WeddingEventDTO,
  type WeddingPaymentDTO,
} from '@soon/shared';

import { db } from '../db';
import { availabilityEntry, budgetItem, guest, task, vendor, wedding, weddingEvent, weddingPayment } from '../db/schema';
import { badRequest, conflict, isCheckViolation, isUniqueViolation, isUuid, notFound } from '../http';
import { parseBody, requireWedding } from '../session';

type TaskRow = typeof task.$inferSelect;
type EventRow = typeof weddingEvent.$inferSelect;
type GuestRow = typeof guest.$inferSelect;
type PaymentRow = typeof weddingPayment.$inferSelect;

export const toTaskDTO = (t: TaskRow): TaskDTO => ({
  id: t.id,
  title: t.title,
  notes: t.notes,
  dueDate: t.dueDate,
  doneAt: t.doneAt?.toISOString() ?? null,
  categorySlug: t.categorySlug,
  templateKey: t.templateKey,
});

export const toEventDTO = (e: EventRow, vendorName: string | null): WeddingEventDTO => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  startsAt: e.startsAt.toISOString(),
  endsAt: e.endsAt?.toISOString() ?? null,
  location: e.location,
  vendorId: e.vendorId,
  vendorName,
  notes: e.notes,
});

const toGuestDTO = (g: GuestRow): GuestDTO => ({
  id: g.id,
  name: g.name,
  side: g.side,
  phone: g.phone,
  rsvp: g.rsvp,
  partySize: g.partySize,
  tableLabel: g.tableLabel,
  notes: g.notes,
});

const toPaymentDTO = (p: PaymentRow): WeddingPaymentDTO => ({
  id: p.id,
  budgetItemId: p.budgetItemId,
  title: p.title,
  amountAgorot: p.amountAgorot,
  dueDate: p.dueDate,
  paidAt: p.paidAt?.toISOString() ?? null,
});

// ---------- generic wedding-scoped collection ----------

type ScopedTable = typeof task | typeof guest | typeof weddingEvent | typeof budgetItem | typeof weddingPayment;

type CollectionOpts<C extends z.ZodType, U extends z.ZodType> = {
  path: string;
  table: ScopedTable;
  createSchema: C;
  updateSchema: U;
  max: number;
  /** Validated body → DB columns. May reply with an error and return null. */
  // Method syntax on purpose: it receives both create and (partial) update bodies.
  toRow(
    body: Partial<z.infer<C>>,
    ctx: { weddingId: string; reply: FastifyReply },
  ): Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  /** The response after any change (usually the whole collection). */
  respond: (weddingId: string) => Promise<unknown>;
  /** Message when a unique rule is broken (409). */
  uniqueMessage?: string;
};

/** POST, PATCH /:id and DELETE /:id for a table keyed by (id, wedding_id). */
function weddingCollection<C extends z.ZodType, U extends z.ZodType>(app: FastifyInstance, o: CollectionOpts<C, U>) {
  const t = o.table as typeof task; // the shared columns (id, weddingId) are identical across tables

  async function write(reply: FastifyReply, run: () => Promise<unknown>) {
    try {
      return await run();
    } catch (err) {
      if (isCheckViolation(err)) return badRequest(reply, 'ערך לא תקין');
      if (isUniqueViolation(err)) return conflict(reply, o.uniqueMessage ?? 'הפריט כבר קיים');
      throw err;
    }
  }

  app.post(o.path, async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const body = await parseBody(o.createSchema, request.body, reply);
    if (!body) return;
    if ((await db.$count(t, eq(t.weddingId, ctx.wedding.id))) >= o.max) {
      return badRequest(reply, `הגעתם למקסימום של ${o.max} פריטים`);
    }
    const row = await o.toRow(body, { weddingId: ctx.wedding.id, reply });
    if (!row) return;
    return write(reply, async () => {
      await db.insert(t).values({ ...row, weddingId: ctx.wedding.id } as typeof task.$inferInsert);
      return reply.status(201).send(await o.respond(ctx.wedding.id));
    });
  });

  app.patch<{ Params: { id: string } }>(`${o.path}/:id`, async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const body = await parseBody(o.updateSchema, request.body, reply);
    if (!body) return;
    const row = await o.toRow(body, { weddingId: ctx.wedding.id, reply });
    if (!row) return;
    return write(reply, async () => {
      if (Object.keys(row).length) {
        const [updated] = await db
          .update(t)
          .set(row)
          .where(and(eq(t.id, request.params.id), eq(t.weddingId, ctx.wedding.id)))
          .returning({ id: t.id });
        if (!updated) return notFound(reply);
      }
      return o.respond(ctx.wedding.id);
    });
  });

  app.delete<{ Params: { id: string } }>(`${o.path}/:id`, async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const [removed] = await db
      .delete(t)
      .where(and(eq(t.id, request.params.id), eq(t.weddingId, ctx.wedding.id)))
      .returning({ id: t.id });
    if (!removed) return notFound(reply);
    return o.respond(ctx.wedding.id);
  });
}

/** Copies the keys present in `body` through `map` (undefined = not sent = unchanged). */
function pick<B extends object>(body: B, map: { [K in keyof B]?: (v: B[K]) => [string, unknown] }) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(map) as (keyof B)[]) {
    if (body[key] !== undefined) {
      const [col, val] = map[key]!(body[key]);
      out[col] = val;
    }
  }
  return out;
}

const same = (col: string) => (v: unknown) => [col, v ?? null] as [string, unknown];

/** Only vendors that exist (any status: a couple may link a vendor they already hired). */
async function vendorExists(id: string | null | undefined) {
  if (!id) return true;
  return (await db.$count(vendor, eq(vendor.id, id))) > 0;
}

// ---------- loaders ----------

async function listTasks(weddingId: string) {
  const rows = await db
    .select()
    .from(task)
    .where(eq(task.weddingId, weddingId))
    .orderBy(sql`${task.doneAt} is not null`, sql`${task.dueDate} asc nulls last`, asc(task.createdAt));
  return rows.map(toTaskDTO);
}

async function listEvents(weddingId: string, where?: SQL) {
  const rows = await db
    .select({ e: weddingEvent, vendorName: vendor.businessName })
    .from(weddingEvent)
    .leftJoin(vendor, eq(vendor.id, weddingEvent.vendorId))
    .where(and(eq(weddingEvent.weddingId, weddingId), where))
    .orderBy(asc(weddingEvent.startsAt));
  const own = rows.map((r) => toEventDTO(r.e, r.vendorName));
  if (where) return own;
  // Entries vendors put in their calendar for this wedding (calls, meetings, the event itself).
  const fromVendors = await db
    .select({ e: availabilityEntry, vendorName: vendor.businessName })
    .from(availabilityEntry)
    .innerJoin(vendor, eq(vendor.id, availabilityEntry.vendorId))
    .where(and(eq(availabilityEntry.weddingId, weddingId), sql`${availabilityEntry.status} <> 'available'`));
  const shared: WeddingEventDTO[] = fromVendors.map(({ e, vendorName }) => ({
    id: `v-${e.id}`,
    kind: e.kind === 'event' ? 'other' : 'meeting',
    title: e.kind === 'call' ? `שיחת התאמה עם ${vendorName}` : (e.title ?? CALENDAR_ENTRY_KIND_LABELS[e.kind]),
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    location: e.location,
    vendorId: e.vendorId,
    vendorName,
    notes: null,
    fromVendor: true,
  }));
  return [...own, ...shared].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function loadGuests(weddingId: string): Promise<GuestListDTO> {
  const rows = await db.select().from(guest).where(eq(guest.weddingId, weddingId)).orderBy(asc(guest.name));
  const people = { total: 0, ...Object.fromEntries(RSVP_STATUSES.map((s) => [s, 0])) } as GuestListDTO['people'];
  for (const g of rows) {
    people[g.rsvp] += g.partySize;
    people.total += g.partySize;
  }
  return { guests: rows.map(toGuestDTO), people };
}

export async function loadBudget(weddingId: string, totalAgorot: number | null): Promise<BudgetDTO> {
  const [items, payments, paidByItem] = await Promise.all([
    db
      .select({ b: budgetItem, linkedVendorName: vendor.businessName })
      .from(budgetItem)
      .leftJoin(vendor, eq(vendor.id, budgetItem.vendorId))
      .where(eq(budgetItem.weddingId, weddingId))
      .orderBy(asc(budgetItem.createdAt)),
    db
      .select()
      .from(weddingPayment)
      .where(eq(weddingPayment.weddingId, weddingId))
      .orderBy(sql`${weddingPayment.paidAt} is not null`, sql`${weddingPayment.dueDate} asc nulls last`),
    db
      .select({ id: weddingPayment.budgetItemId, paid: sql<number>`sum(${weddingPayment.amountAgorot})::int` })
      .from(weddingPayment)
      .where(and(eq(weddingPayment.weddingId, weddingId), isNotNull(weddingPayment.paidAt)))
      .groupBy(weddingPayment.budgetItemId),
  ]);
  const paidMap = new Map(paidByItem.map((p) => [p.id, Number(p.paid)]));
  const dto = items.map(({ b, linkedVendorName }) => ({
    id: b.id,
    category: b.category,
    title: b.title,
    vendorId: b.vendorId,
    vendorName: linkedVendorName ?? b.vendorName,
    plannedAgorot: b.plannedAgorot,
    actualAgorot: b.actualAgorot,
    paidAgorot: paidMap.get(b.id) ?? 0,
    notes: b.notes,
  }));
  return {
    totalAgorot,
    plannedAgorot: dto.reduce((s, i) => s + (i.plannedAgorot ?? 0), 0),
    committedAgorot: dto.reduce((s, i) => s + (i.actualAgorot ?? 0), 0),
    paidAgorot: [...paidMap.values()].reduce((s, v) => s + v, 0),
    items: dto,
    payments: payments.map(toPaymentDTO),
  };
}

// ---------- routes ----------

export async function planningRoutes(app: FastifyInstance) {
  /** Shared guard for the GET endpoints below. */
  const withWedding =
    <R>(fn: (w: NonNullable<Awaited<ReturnType<typeof requireWedding>>>['wedding']) => Promise<R>) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = await requireWedding(request, reply);
      if (!ctx) return;
      return fn(ctx.wedding);
    };

  // ----- checklist -----
  app.get('/api/planning/tasks', withWedding((w) => listTasks(w.id)));
  weddingCollection(app, {
    path: '/api/planning/tasks',
    table: task,
    createSchema: taskInputSchema,
    updateSchema: taskUpdateSchema,
    max: 500,
    respond: listTasks,
    toRow: (b: Partial<z.infer<typeof taskUpdateSchema>>) =>
      pick(b, {
        title: same('title'),
        notes: same('notes'),
        dueDate: same('dueDate'),
        remindAt: (v) => ['remindAt', v ? new Date(v) : null],
        done: (v) => ['doneAt', v ? new Date() : null],
      }),
  });

  // ----- budget -----
  app.get('/api/planning/budget', withWedding((w) => loadBudget(w.id, w.budgetTotalAgorot)));

  const respondBudget = async (weddingId: string) => {
    const [w] = await db.select({ total: wedding.budgetTotalAgorot }).from(wedding).where(eq(wedding.id, weddingId));
    return loadBudget(weddingId, w?.total ?? null);
  };

  weddingCollection(app, {
    path: '/api/planning/budget/items',
    table: budgetItem,
    createSchema: budgetItemInputSchema,
    updateSchema: budgetItemUpdateSchema,
    max: 200,
    respond: respondBudget,
    uniqueMessage: 'כבר יש שורת תקציב לקטגוריה הזו. ערכו את השורה הקיימת.',
    toRow: async (b: Partial<z.infer<typeof budgetItemUpdateSchema>>, { reply }) => {
      if (!(await vendorExists(b.vendorId))) return (await badRequest(reply, 'Unknown vendor', 'vendorId'), null);
      return pick(b, {
        category: same('category'),
        title: same('title'),
        vendorId: same('vendorId'),
        vendorName: same('vendorName'),
        planned: same('plannedAgorot'),
        actual: same('actualAgorot'),
        notes: same('notes'),
      });
    },
  });

  weddingCollection(app, {
    path: '/api/planning/budget/payments',
    table: weddingPayment,
    createSchema: weddingPaymentInputSchema,
    updateSchema: weddingPaymentUpdateSchema,
    max: 500,
    respond: respondBudget,
    toRow: async (b: Partial<z.infer<typeof weddingPaymentUpdateSchema>>, { weddingId, reply }) => {
      if (b.budgetItemId) {
        const owned = await db.$count(budgetItem, and(eq(budgetItem.id, b.budgetItemId), eq(budgetItem.weddingId, weddingId)));
        if (!owned) return (await badRequest(reply, 'Unknown budget item', 'budgetItemId'), null);
      }
      return pick(b, {
        budgetItemId: same('budgetItemId'),
        title: same('title'),
        amount: same('amountAgorot'),
        dueDate: same('dueDate'),
        // Paid only on an explicit user action (spec §13).
        paid: (v) => ['paidAt', v ? new Date() : null],
      });
    },
  });

  // ----- guests -----
  app.get('/api/planning/guests', withWedding((w) => loadGuests(w.id)));
  weddingCollection(app, {
    path: '/api/planning/guests',
    table: guest,
    createSchema: guestInputSchema,
    updateSchema: guestUpdateSchema,
    max: 2000,
    respond: loadGuests,
    toRow: (b: Partial<z.infer<typeof guestUpdateSchema>>) =>
      pick(b, {
        name: same('name'),
        side: same('side'),
        phone: same('phone'),
        rsvp: same('rsvp'),
        partySize: same('partySize'),
        tableLabel: same('tableLabel'),
        notes: same('notes'),
      }),
  });

  app.post('/api/planning/guests/bulk', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const body = await parseBody(guestBulkSchema, request.body, reply);
    if (!body) return;
    const [existing] = await db.select({ n: count() }).from(guest).where(eq(guest.weddingId, ctx.wedding.id));
    if ((existing?.n ?? 0) + body.names.length > 2000) return badRequest(reply, 'הגעתם למקסימום של 2000 מוזמנים');
    await db.insert(guest).values(body.names.map((name) => ({ weddingId: ctx.wedding.id, name, side: body.side })));
    return reply.status(201).send(await loadGuests(ctx.wedding.id));
  });

  // ----- wedding calendar -----
  app.get('/api/planning/events', withWedding((w) => listEvents(w.id)));
  weddingCollection(app, {
    path: '/api/planning/events',
    table: weddingEvent,
    createSchema: weddingEventInputSchema,
    updateSchema: weddingEventUpdateSchema,
    max: 500,
    respond: (id) => listEvents(id),
    toRow: async (b: Partial<z.infer<typeof weddingEventUpdateSchema>>, { reply }) => {
      if (!(await vendorExists(b.vendorId))) return (await badRequest(reply, 'Unknown vendor', 'vendorId'), null);
      return pick(b, {
        kind: same('kind'),
        title: same('title'),
        startsAt: (v) => ['startsAt', new Date(v!)],
        endsAt: (v) => ['endsAt', v ? new Date(v) : null],
        location: same('location'),
        vendorId: same('vendorId'),
        notes: same('notes'),
      });
    },
  });

  /** Vendors the couple can link in budget / calendar: the ones they're talking to or saved. */
  app.get('/api/planning/my-vendors', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const rows = await db.execute<{ id: string; slug: string; business_name: string; category_slug: string; lead_status: string | null }>(sql`
      select v.id, v.slug, v.business_name, v.category_slug, l.status as lead_status
      from vendor v
      left join lead l on l.vendor_id = v.id and l.wedding_id = ${ctx.wedding.id}
      where l.id is not null
         or exists (select 1 from saved_vendor s where s.vendor_id = v.id and s.wedding_id = ${ctx.wedding.id})
      order by (l.status in ('booked','completed')) desc nulls last, v.business_name
    `);
    return rows.rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      businessName: r.business_name,
      categorySlug: r.category_slug,
      leadStatus: r.lead_status,
    }));
  });
}
