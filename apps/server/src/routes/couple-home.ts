/** The couple's home screen in one request (spec §4). */
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, lt, notInArray, sql, sum } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  addDays,
  categoryLabel,
  CHECKLIST_TEMPLATES,
  CLOSED_LEAD_STATUSES,
  daysBetween,
  todayIso,
  type CoupleHomeDTO,
  type HomeInsight,
  type VendorCardDTO,
} from '@soon/shared';

import { db } from '../db';
import { budgetItem, lead, task, vendor, vendorRegion, weddingEvent, weddingPayment } from '../db/schema';
import { requireWedding, type WeddingRow } from '../session';
import { queryVendorCards } from '../services/vendor-cards';
import { toEventDTO, toTaskDTO } from './planning';
import { loadWedding } from './weddings';

async function recommendations(w: WeddingRow, needed: string[], closed: string[]): Promise<VendorCardDTO[]> {
  const base = [
    needed.length ? inArray(vendor.categorySlug, needed) : undefined,
    closed.length ? notInArray(vendor.categorySlug, closed) : undefined,
  ];
  const inRegion = w.region
    ? sql`exists (select 1 from ${vendorRegion} where ${vendorRegion.vendorId} = ${vendor.id} and ${vendorRegion.region} = ${w.region})`
    : undefined;
  const opts = { weddingId: w.id, date: w.weddingDate, limit: 8 } as const;
  const local = await queryVendorCards({ ...opts, where: [...base, inRegion] });
  if (local.items.length >= 4 || !inRegion) return local.items;
  // Not enough nearby: widen to the whole country, nearby ones first.
  const wide = await queryVendorCards({ ...opts, where: base });
  const seen = new Set(local.items.map((v) => v.id));
  return [...local.items, ...wide.items.filter((v) => !seen.has(v.id))].slice(0, 8);
}

function buildInsights(home: Omit<CoupleHomeDTO, 'insights' | 'recommended' | 'fresh'>, today: string): HomeInsight[] {
  const out: HomeInsight[] = [];
  const { wedding: w, daysToGo } = home;

  if (daysToGo != null && daysToGo >= 0) {
    const months = Math.floor(daysToGo / 30);
    if (daysToGo === 0) out.push({ key: 'today', text: 'היום זה קורה. מזל טוב!' });
    else if (months >= 1 && daysToGo % 30 < 7) out.push({ key: 'months', text: `נותרו ${months === 1 ? 'חודש' : `${months} חודשים`} עד החתונה` });
    else if (daysToGo <= 14) out.push({ key: 'soon', text: `עוד ${daysToGo} ימים. הגיע הזמן לאשר סופית מול הספקים` });
  }

  // "You haven't closed a DJ yet": needed categories whose booking task is already due.
  const neededSlugs = new Set(w.categories.filter((c) => c.status === 'needed').map((c) => c.slug));
  if (w.weddingDate) {
    const urgent = CHECKLIST_TEMPLATES.filter(
      (t) => t.closesCategory && neededSlugs.has(t.closesCategory) && addDays(w.weddingDate!, -t.daysBefore) <= today,
    ).slice(0, 2);
    for (const t of urgent) {
      out.push({
        key: `need-${t.closesCategory}`,
        text: `עדיין לא סגרתם ${categoryLabel(t.closesCategory!)}`,
        href: `/couple/explore?category=${t.closesCategory}`,
      });
    }
  }

  if (home.nextEvent) {
    const eventDay = home.nextEvent.startsAt.slice(0, 10);
    if (eventDay === addDays(today, 1)) out.push({ key: 'tomorrow', text: `מחר: ${home.nextEvent.title}`, href: '/couple/planning/calendar' });
  }
  if (home.tasks.overdue > 0) {
    out.push({
      key: 'overdue',
      text: home.tasks.overdue === 1 ? 'משימה אחת עברה את תאריך היעד' : `${home.tasks.overdue} משימות עברו את תאריך היעד`,
      href: '/couple/planning/checklist',
    });
  }
  const { totalAgorot, committedAgorot } = home.budget;
  if (totalAgorot && committedAgorot > totalAgorot) {
    out.push({ key: 'over-budget', text: 'ההתחייבויות עברו את התקציב הכולל', href: '/couple/planning/budget' });
  }
  return out.slice(0, 4);
}

export async function coupleHomeRoutes(app: FastifyInstance) {
  app.get('/api/couple/home', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const w = ctx.wedding;
    const today = todayIso();

    const [wedding, [committed], [paid], [booked], taskStats, [nextTask], [nextEvent], fresh] = await Promise.all([
      loadWedding(w),
      db.select({ v: sum(budgetItem.actualAgorot) }).from(budgetItem).where(eq(budgetItem.weddingId, w.id)),
      db
        .select({ v: sum(weddingPayment.amountAgorot) })
        .from(weddingPayment)
        .where(and(eq(weddingPayment.weddingId, w.id), isNotNull(weddingPayment.paidAt))),
      db
        .select({ n: count() })
        .from(lead)
        .where(and(eq(lead.weddingId, w.id), inArray(lead.status, CLOSED_LEAD_STATUSES))),
      db
        .select({
          open: sql<number>`count(*) filter (where ${task.doneAt} is null)::int`,
          done: sql<number>`count(*) filter (where ${task.doneAt} is not null)::int`,
          overdue: sql<number>`count(*) filter (where ${task.doneAt} is null and ${task.dueDate} < ${today})::int`,
        })
        .from(task)
        .where(eq(task.weddingId, w.id)),
      db
        .select()
        .from(task)
        .where(and(eq(task.weddingId, w.id), isNull(task.doneAt)))
        .orderBy(sql`${task.dueDate} asc nulls last`, asc(task.createdAt))
        .limit(1),
      db
        .select({ e: weddingEvent, vendorName: vendor.businessName })
        .from(weddingEvent)
        .leftJoin(vendor, eq(vendor.id, weddingEvent.vendorId))
        .where(and(eq(weddingEvent.weddingId, w.id), gte(weddingEvent.startsAt, new Date())))
        .orderBy(asc(weddingEvent.startsAt))
        .limit(1),
      queryVendorCards({
        weddingId: w.id,
        date: w.weddingDate,
        limit: 6,
        where: [lt(sql`now() - ${vendor.reviewedAt}`, sql`interval '60 days'`)],
        sort: 'relevance',
      }),
    ]);

    const closed = wedding.categories.filter((c) => c.status === 'closed').map((c) => c.slug);
    const needed = wedding.categories.filter((c) => c.status === 'needed').map((c) => c.slug);
    const stats = taskStats[0] ?? { open: 0, done: 0, overdue: 0 };

    const base = {
      wedding,
      daysToGo: w.weddingDate ? daysBetween(today, w.weddingDate) : null,
      budget: {
        totalAgorot: w.budgetTotalAgorot,
        committedAgorot: Number(committed?.v ?? 0),
        paidAgorot: Number(paid?.v ?? 0),
      },
      vendors: { closed: closed.length, needed: needed.length, booked: booked?.n ?? 0 },
      tasks: { ...stats, next: nextTask ? toTaskDTO(nextTask) : null },
      nextEvent: nextEvent ? toEventDTO(nextEvent.e, nextEvent.vendorName) : null,
    };

    const home: CoupleHomeDTO = {
      ...base,
      insights: buildInsights(base, today),
      recommended: await recommendations(w, needed, closed),
      fresh: fresh.items,
    };
    return home;
  });
}
