/** Couple onboarding and wedding profile (spec §3). */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  coupleOnboardingSchema,
  weddingUpdateSchema,
  type RegionSlug,
  type WeddingDTO,
} from '@soon/shared';

import { db, type DB } from '../db';
import { category, user, wedding, weddingCategory, weddingMember } from '../db/schema';
import { conflict } from '../http';
import { findWeddingForUser, parseBody, requireCoupleUser, requireWedding, type WeddingRow } from '../session';
import { syncChecklist } from '../services/checklist';

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export async function loadWedding(row: WeddingRow): Promise<WeddingDTO> {
  const cats = await db
    .select({ slug: weddingCategory.categorySlug, status: weddingCategory.status, label: category.labelHe })
    .from(weddingCategory)
    .innerJoin(category, eq(category.slug, weddingCategory.categorySlug))
    .where(eq(weddingCategory.weddingId, row.id))
    .orderBy(category.sortOrder);
  return {
    id: row.id,
    partner1Name: row.partner1Name,
    partner2Name: row.partner2Name,
    weddingDate: row.weddingDate,
    region: row.region as RegionSlug | null,
    venueName: row.venueName,
    budgetTotalAgorot: row.budgetTotalAgorot,
    coverImageUrl: row.coverImageUrl,
    categories: cats,
  };
}

/** Replaces the wedding's closed/needed category lists. A slug in both counts as closed. */
async function setCategories(tx: Tx, weddingId: string, closed: string[], needed: string[]) {
  await tx.delete(weddingCategory).where(eq(weddingCategory.weddingId, weddingId));
  const closedSet = new Set(closed);
  const rows = [
    ...[...closedSet].map((slug) => ({ weddingId, categorySlug: slug, status: 'closed' as const })),
    ...[...new Set(needed)]
      .filter((slug) => !closedSet.has(slug))
      .map((slug) => ({ weddingId, categorySlug: slug, status: 'needed' as const })),
  ];
  if (rows.length) await tx.insert(weddingCategory).values(rows);
}

export async function weddingRoutes(app: FastifyInstance) {
  app.get('/api/weddings/me', async (request, reply) => {
    const u = await requireCoupleUser(request, reply);
    if (!u) return;
    const row = await findWeddingForUser(u.id);
    return { wedding: row ? await loadWedding(row) : null };
  });

  /** Onboarding: creates the wedding and links the signed-in partner to it. */
  app.post('/api/weddings', async (request, reply) => {
    const u = await requireCoupleUser(request, reply);
    if (!u) return;
    const body = await parseBody(coupleOnboardingSchema, request.body, reply);
    if (!body) return;
    if (await findWeddingForUser(u.id)) return conflict(reply, 'Wedding already exists');

    const created = await db.transaction(async (tx) => {
      const [w] = await tx
        .insert(wedding)
        .values({
          partner1Name: body.partner1Name,
          partner2Name: body.partner2Name,
          weddingDate: body.weddingDate ?? null,
          region: body.region ?? null,
          venueName: body.venueName ?? null,
          budgetTotalAgorot: body.budgetTotal ?? null,
        })
        .returning();
      await tx.insert(weddingMember).values({ weddingId: w!.id, userId: u.id, role: 'partner' });
      await setCategories(tx, w!.id, body.closedCategories, body.neededCategories);
      if (body.phone) await tx.update(user).set({ phone: body.phone }).where(eq(user.id, u.id));
      await syncChecklist(tx, w!);
      return w!;
    });

    return reply.status(201).send(await loadWedding(created));
  });

  app.patch('/api/weddings/me', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const body = await parseBody(weddingUpdateSchema, request.body, reply);
    if (!body) return;

    const set: Partial<typeof wedding.$inferInsert> = {};
    if (body.partner1Name !== undefined) set.partner1Name = body.partner1Name;
    if (body.partner2Name !== undefined) set.partner2Name = body.partner2Name;
    if (body.weddingDate !== undefined) set.weddingDate = body.weddingDate;
    if (body.region !== undefined) set.region = body.region;
    if (body.venueName !== undefined) set.venueName = body.venueName || null;
    if (body.budgetTotal !== undefined) set.budgetTotalAgorot = body.budgetTotal;

    const updated = await db.transaction(async (tx) => {
      const [w] = Object.keys(set).length
        ? await tx.update(wedding).set(set).where(eq(wedding.id, ctx.wedding.id)).returning()
        : [ctx.wedding];
      if (body.closedCategories || body.neededCategories) {
        const current = await tx.select().from(weddingCategory).where(eq(weddingCategory.weddingId, ctx.wedding.id));
        const closed = body.closedCategories ?? current.filter((c) => c.status === 'closed').map((c) => c.categorySlug);
        const needed = body.neededCategories ?? current.filter((c) => c.status === 'needed').map((c) => c.categorySlug);
        await setCategories(tx, ctx.wedding.id, closed, needed);
      }
      // A new wedding date re-plans the auto-generated, still-open checklist items.
      if (body.weddingDate !== undefined) await syncChecklist(tx, w!);
      return w!;
    });

    return loadWedding(updated);
  });
}
