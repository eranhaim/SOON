import { randomInt } from 'node:crypto';

import { and, asc, eq, inArray, max } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply } from 'fastify';

import {
  addMediaSchema,
  getVendorReadiness,
  reorderSchema,
  vendorFaqInputSchema,
  vendorOnboardingSchema,
  vendorPackageInputSchema,
  vendorProfileUpdateSchema,
  type RegionSlug,
  type VendorOwnerDTO,
  type VendorPublicDTO,
} from '@soon/shared';

import { db } from '../db';
import { category, vendor, vendorFaq, vendorMedia, vendorPackage, vendorRegion } from '../db/schema';
import { getUser, parseBody, requireOwnVendor, requireVendorUser } from '../session';
import { storage } from '../storage';
import { vendorScope } from './uploads';

const MAX_GALLERY = 60;
const MAX_PACKAGES = 20;
const MAX_FAQS = 30;

type VendorRow = typeof vendor.$inferSelect;
type SortableTable = typeof vendorMedia | typeof vendorPackage | typeof vendorFaq;

// ---------- helpers ----------

/** Short public id for /v/<slug>. Hebrew names don't transliterate cleanly, so it's random. */
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
function randomSlug() {
  return Array.from({ length: 7 }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join('');
}

export async function loadVendor(row: VendorRow): Promise<VendorOwnerDTO> {
  const [cat, regions, media, packages, faqs] = await Promise.all([
    db.select({ label: category.labelHe }).from(category).where(eq(category.slug, row.categorySlug)).limit(1),
    db.select({ region: vendorRegion.region }).from(vendorRegion).where(eq(vendorRegion.vendorId, row.id)),
    db.select().from(vendorMedia).where(eq(vendorMedia.vendorId, row.id)).orderBy(asc(vendorMedia.sortOrder)),
    db.select().from(vendorPackage).where(eq(vendorPackage.vendorId, row.id)).orderBy(asc(vendorPackage.sortOrder)),
    db.select().from(vendorFaq).where(eq(vendorFaq.vendorId, row.id)).orderBy(asc(vendorFaq.sortOrder)),
  ]);
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    statusReason: row.statusReason,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    businessName: row.businessName,
    categorySlug: row.categorySlug,
    categoryLabel: cat[0]?.label ?? row.categorySlug,
    about: row.about,
    phone: row.phone,
    email: row.email,
    websiteUrl: row.websiteUrl,
    instagramUrl: row.instagramUrl,
    logoUrl: row.logoUrl,
    coverUrl: row.coverUrl,
    priceFromAgorot: row.priceFromAgorot,
    priceToAgorot: row.priceToAgorot,
    cancellationPolicy: row.cancellationPolicy,
    isFeatured: row.isFeatured,
    regions: regions.map((r) => r.region as RegionSlug),
    media: media.map((m) => ({ id: m.id, kind: m.kind, url: m.url, caption: m.caption, sortOrder: m.sortOrder })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      priceAgorot: p.priceAgorot,
      includes: p.includes,
      sortOrder: p.sortOrder,
    })),
    faqs: faqs.map((f) => ({ id: f.id, question: f.question, answer: f.answer, sortOrder: f.sortOrder })),
  };
}

function toPublic(v: VendorOwnerDTO): VendorPublicDTO {
  const { status: _s, statusReason: _r, submittedAt: _sa, reviewedAt: _ra, phone: _p, email: _e, ...pub } = v;
  return pub;
}

async function reloadOwn(vendorId: string) {
  const [row] = await db.select().from(vendor).where(eq(vendor.id, vendorId)).limit(1);
  return loadVendor(row!);
}

async function nextSortOrder(table: SortableTable, vendorId: string) {
  const [r] = await db.select({ m: max(table.sortOrder) }).from(table).where(eq(table.vendorId, vendorId));
  return (r?.m ?? -1) + 1;
}

async function countFor(table: SortableTable, vendorId: string) {
  return db.$count(table, eq(table.vendorId, vendorId));
}

async function reorder(table: SortableTable, vendorId: string, ids: string[]) {
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries()) {
      await tx
        .update(table as typeof vendorMedia)
        .set({ sortOrder: i })
        .where(and(eq(table.id, id), eq(table.vendorId, vendorId)));
    }
  });
}

/** Postgres check-constraint violation (e.g. price range) → 400 instead of 500. */
function isCheckViolation(err: unknown) {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23514';
}

async function badRequest(reply: FastifyReply, error: string, field?: string) {
  return reply.status(400).send({ error, field });
}

// ---------- routes ----------

export async function vendorRoutes(app: FastifyInstance) {
  /** The signed-in vendor's own storefront, or null before onboarding. */
  app.get('/api/vendors/me', async (request, reply) => {
    const user = await requireVendorUser(request, reply);
    if (!user) return;
    const [row] = await db.select().from(vendor).where(eq(vendor.ownerUserId, user.id)).limit(1);
    return { vendor: row ? await loadVendor(row) : null };
  });

  /** Onboarding: create the business. One business per vendor user for now. */
  app.post('/api/vendors', async (request, reply) => {
    const user = await requireVendorUser(request, reply);
    if (!user) return;
    const body = await parseBody(vendorOnboardingSchema, request.body, reply);
    if (!body) return;

    const [existing] = await db.select({ id: vendor.id }).from(vendor).where(eq(vendor.ownerUserId, user.id)).limit(1);
    if (existing) return reply.status(409).send({ error: 'Business already exists' });

    const created = await db.transaction(async (tx) => {
      let row: VendorRow | undefined;
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        [row] = await tx
          .insert(vendor)
          .values({
            ownerUserId: user.id,
            businessName: body.businessName,
            slug: randomSlug(),
            categorySlug: body.category,
            status: 'draft',
            phone: body.phone,
            email: user.email,
            about: body.about ?? null,
            priceFromAgorot: body.priceFrom ?? null,
            priceToAgorot: body.priceTo ?? null,
          })
          .onConflictDoNothing({ target: vendor.slug })
          .returning();
      }
      if (!row) throw new Error('Could not allocate a unique slug');
      await tx.insert(vendorRegion).values(body.regions.map((region) => ({ vendorId: row.id, region })));
      return row;
    });

    return reply.status(201).send(await loadVendor(created));
  });

  /** Partial update of the storefront. */
  app.patch('/api/vendors/me', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(vendorProfileUpdateSchema, request.body, reply);
    if (!body) return;
    const scope = vendorScope(ctx.vendor.id);

    for (const field of ['coverUrl', 'logoUrl'] as const) {
      const url = body[field];
      if (url && !storage.keyIfOwned(url, scope)) return badRequest(reply, 'Unknown image', field);
    }

    const set: Partial<typeof vendor.$inferInsert> = {};
    if (body.businessName !== undefined) set.businessName = body.businessName;
    if (body.category !== undefined) set.categorySlug = body.category;
    if (body.about !== undefined) set.about = body.about || null;
    if (body.phone !== undefined) set.phone = body.phone;
    if (body.email !== undefined) set.email = body.email;
    if (body.websiteUrl !== undefined) set.websiteUrl = body.websiteUrl;
    if (body.instagramUrl !== undefined) set.instagramUrl = body.instagramUrl;
    if (body.priceFrom !== undefined) set.priceFromAgorot = body.priceFrom;
    if (body.priceTo !== undefined) set.priceToAgorot = body.priceTo;
    if (body.cancellationPolicy !== undefined) set.cancellationPolicy = body.cancellationPolicy || null;
    if (body.coverUrl !== undefined) set.coverUrl = body.coverUrl;
    if (body.logoUrl !== undefined) set.logoUrl = body.logoUrl;

    try {
      await db.transaction(async (tx) => {
        if (Object.keys(set).length) await tx.update(vendor).set(set).where(eq(vendor.id, ctx.vendor.id));
        if (body.regions) {
          await tx.delete(vendorRegion).where(eq(vendorRegion.vendorId, ctx.vendor.id));
          await tx.insert(vendorRegion).values(body.regions.map((region) => ({ vendorId: ctx.vendor.id, region })));
        }
      });
    } catch (err) {
      if (isCheckViolation(err)) return badRequest(reply, 'מחיר ההתחלה גבוה ממחיר הסיום', 'priceTo');
      throw err;
    }

    // Replaced images: remove the old files.
    if (body.coverUrl !== undefined && ctx.vendor.coverUrl && ctx.vendor.coverUrl !== body.coverUrl) {
      void storage.remove(ctx.vendor.coverUrl, scope);
    }
    if (body.logoUrl !== undefined && ctx.vendor.logoUrl && ctx.vendor.logoUrl !== body.logoUrl) {
      void storage.remove(ctx.vendor.logoUrl, scope);
    }

    return reloadOwn(ctx.vendor.id);
  });

  // ----- gallery -----
  app.post('/api/vendors/me/media', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(addMediaSchema, request.body, reply);
    if (!body) return;
    if (!storage.keyIfOwned(body.url, vendorScope(ctx.vendor.id))) return badRequest(reply, 'Unknown image', 'url');
    if ((await countFor(vendorMedia, ctx.vendor.id)) >= MAX_GALLERY) {
      return badRequest(reply, `אפשר להעלות עד ${MAX_GALLERY} תמונות`);
    }
    await db.insert(vendorMedia).values({
      vendorId: ctx.vendor.id,
      url: body.url,
      caption: body.caption ?? null,
      sortOrder: await nextSortOrder(vendorMedia, ctx.vendor.id),
    });
    return reply.status(201).send(await reloadOwn(ctx.vendor.id));
  });

  app.delete<{ Params: { id: string } }>('/api/vendors/me/media/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const [removed] = await db
      .delete(vendorMedia)
      .where(and(eq(vendorMedia.id, request.params.id), eq(vendorMedia.vendorId, ctx.vendor.id)))
      .returning();
    if (!removed) return reply.status(404).send({ error: 'Not found' });
    void storage.remove(removed.url, vendorScope(ctx.vendor.id));
    return reloadOwn(ctx.vendor.id);
  });

  // ----- packages -----
  app.post('/api/vendors/me/packages', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(vendorPackageInputSchema, request.body, reply);
    if (!body) return;
    if ((await countFor(vendorPackage, ctx.vendor.id)) >= MAX_PACKAGES) {
      return badRequest(reply, `אפשר להגדיר עד ${MAX_PACKAGES} חבילות`);
    }
    await db.insert(vendorPackage).values({
      vendorId: ctx.vendor.id,
      name: body.name,
      description: body.description ?? null,
      priceAgorot: body.priceAgorot ?? null,
      includes: body.includes,
      sortOrder: await nextSortOrder(vendorPackage, ctx.vendor.id),
    });
    return reply.status(201).send(await reloadOwn(ctx.vendor.id));
  });

  app.put<{ Params: { id: string } }>('/api/vendors/me/packages/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(vendorPackageInputSchema, request.body, reply);
    if (!body) return;
    const [updated] = await db
      .update(vendorPackage)
      .set({
        name: body.name,
        description: body.description ?? null,
        priceAgorot: body.priceAgorot ?? null,
        includes: body.includes,
      })
      .where(and(eq(vendorPackage.id, request.params.id), eq(vendorPackage.vendorId, ctx.vendor.id)))
      .returning({ id: vendorPackage.id });
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return reloadOwn(ctx.vendor.id);
  });

  app.delete<{ Params: { id: string } }>('/api/vendors/me/packages/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const [removed] = await db
      .delete(vendorPackage)
      .where(and(eq(vendorPackage.id, request.params.id), eq(vendorPackage.vendorId, ctx.vendor.id)))
      .returning({ id: vendorPackage.id });
    if (!removed) return reply.status(404).send({ error: 'Not found' });
    return reloadOwn(ctx.vendor.id);
  });

  // ----- FAQ -----
  app.post('/api/vendors/me/faqs', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(vendorFaqInputSchema, request.body, reply);
    if (!body) return;
    if ((await countFor(vendorFaq, ctx.vendor.id)) >= MAX_FAQS) {
      return badRequest(reply, `אפשר להגדיר עד ${MAX_FAQS} שאלות`);
    }
    await db.insert(vendorFaq).values({
      vendorId: ctx.vendor.id,
      question: body.question,
      answer: body.answer,
      sortOrder: await nextSortOrder(vendorFaq, ctx.vendor.id),
    });
    return reply.status(201).send(await reloadOwn(ctx.vendor.id));
  });

  app.put<{ Params: { id: string } }>('/api/vendors/me/faqs/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(vendorFaqInputSchema, request.body, reply);
    if (!body) return;
    const [updated] = await db
      .update(vendorFaq)
      .set({ question: body.question, answer: body.answer })
      .where(and(eq(vendorFaq.id, request.params.id), eq(vendorFaq.vendorId, ctx.vendor.id)))
      .returning({ id: vendorFaq.id });
    if (!updated) return reply.status(404).send({ error: 'Not found' });
    return reloadOwn(ctx.vendor.id);
  });

  app.delete<{ Params: { id: string } }>('/api/vendors/me/faqs/:id', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const [removed] = await db
      .delete(vendorFaq)
      .where(and(eq(vendorFaq.id, request.params.id), eq(vendorFaq.vendorId, ctx.vendor.id)))
      .returning({ id: vendorFaq.id });
    if (!removed) return reply.status(404).send({ error: 'Not found' });
    return reloadOwn(ctx.vendor.id);
  });

  // ----- reorder (gallery / packages / faqs) -----
  const sortable = { media: vendorMedia, packages: vendorPackage, faqs: vendorFaq } as const;
  app.put<{ Params: { list: string } }>('/api/vendors/me/:list/order', async (request, reply) => {
    const table = sortable[request.params.list as keyof typeof sortable];
    if (!table) return reply.status(404).send({ error: 'Not found' });
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const body = await parseBody(reorderSchema, request.body, reply);
    if (!body) return;
    await reorder(table, ctx.vendor.id, body.ids);
    return reloadOwn(ctx.vendor.id);
  });

  /** Submit the storefront for admin approval (draft/rejected → pending). */
  app.post('/api/vendors/me/submit', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (ctx.vendor.status !== 'draft' && ctx.vendor.status !== 'rejected') {
      return reply.status(409).send({ error: `Cannot submit while ${ctx.vendor.status}` });
    }
    const current = await loadVendor(ctx.vendor);
    const missing = getVendorReadiness(current).filter((i) => !i.done);
    if (missing.length) {
      return reply.status(400).send({ error: 'הפרופיל עדיין לא מלא', missing: missing.map((m) => m.key) });
    }
    await db
      .update(vendor)
      .set({ status: 'pending', submittedAt: new Date(), statusReason: null })
      .where(and(eq(vendor.id, ctx.vendor.id), inArray(vendor.status, ['draft', 'rejected'])));
    return reloadOwn(ctx.vendor.id);
  });

  /**
   * Public vendor page. Only approved storefronts are public; the owner and admins can
   * see any status (preview / review).
   */
  app.get<{ Params: { slug: string } }>('/api/vendors/:slug', async (request, reply) => {
    const [row] = await db.select().from(vendor).where(eq(vendor.slug, request.params.slug)).limit(1);
    if (!row) return reply.status(404).send({ error: 'Not found' });
    if (row.status !== 'approved') {
      const user = await getUser(request);
      const allowed = user && (user.id === row.ownerUserId || user.role === 'admin');
      if (!allowed) return reply.status(404).send({ error: 'Not found' });
    }
    return toPublic(await loadVendor(row));
  });
}
