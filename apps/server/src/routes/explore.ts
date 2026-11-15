/** Couples discovering vendors: search (spec §5) and saved vendors (spec §6). */
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { savedNoteSchema, vendorSearchSchema, type SavedVendorDTO, type VendorSearchResult } from '@soon/shared';

import { db } from '../db';
import { savedVendor, vendor } from '../db/schema';
import { badRequest, isUuid, notFound } from '../http';
import { findWeddingForUser, getUser, parseBody, requireWedding } from '../session';
import { queryVendorCards, searchFilters } from '../services/vendor-cards';

/** Opaque offset cursor. Fine at marketplace scale; switch to keyset if lists get long. */
const encodeCursor = (offset: number) => Buffer.from(String(offset)).toString('base64url');
const decodeCursor = (c: string | undefined) => {
  const n = c ? Number(Buffer.from(c, 'base64url').toString()) : 0;
  return Number.isInteger(n) && n >= 0 ? n : 0;
};

/** The signed-in couple's wedding (for saved flags / their date), if any. Never fails. */
async function viewerWedding(request: Parameters<typeof getUser>[0]) {
  const u = await getUser(request);
  return u?.role === 'couple' ? findWeddingForUser(u.id) : null;
}

export async function exploreRoutes(app: FastifyInstance) {
  /** Public search. Signed-in couples also get `saved` flags and availability on their date. */
  app.get('/api/search/vendors', async (request, reply) => {
    const parsed = vendorSearchSchema.safeParse(request.query);
    if (!parsed.success) return badRequest(reply, 'Invalid search', parsed.error.issues[0]?.path.join('.'));
    const s = parsed.data;
    const w = await viewerWedding(request);
    const date = s.date ?? w?.weddingDate ?? null;
    const offset = decodeCursor(s.cursor);

    const { items, total } = await queryVendorCards({
      where: searchFilters({ ...s, date: date ?? undefined }),
      weddingId: w?.id,
      date,
      sort: s.sort,
      limit: s.limit,
      offset,
    });
    const result: VendorSearchResult = {
      items,
      total,
      nextCursor: offset + items.length < total ? encodeCursor(offset + items.length) : null,
    };
    return result;
  });

  // ----- saved (shared by both partners: it belongs to the wedding) -----
  app.get('/api/saved', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const rows = await db
      .select()
      .from(savedVendor)
      .where(eq(savedVendor.weddingId, ctx.wedding.id))
      .orderBy(desc(savedVendor.createdAt));
    if (!rows.length) return [];
    const { items } = await queryVendorCards({
      where: [inArray(vendor.id, rows.map((r) => r.vendorId))],
      weddingId: ctx.wedding.id,
      date: ctx.wedding.weddingDate,
      limit: rows.length,
    });
    const byId = new Map(items.map((c) => [c.id, c]));
    // Keep saved order; vendors that are no longer approved drop out of the list.
    return rows.flatMap((r): SavedVendorDTO[] => {
      const card = byId.get(r.vendorId);
      return card ? [{ ...card, note: r.note, savedAt: r.createdAt.toISOString() }] : [];
    });
  });

  app.put<{ Params: { vendorId: string } }>('/api/saved/:vendorId', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const { vendorId } = request.params;
    if (!isUuid(vendorId)) return notFound(reply);
    const [v] = await db
      .select({ id: vendor.id })
      .from(vendor)
      .where(and(eq(vendor.id, vendorId), eq(vendor.status, 'approved')));
    if (!v) return notFound(reply);
    await db
      .insert(savedVendor)
      .values({ weddingId: ctx.wedding.id, vendorId, savedByUserId: ctx.user.id })
      .onConflictDoNothing();
    return { saved: true };
  });

  app.delete<{ Params: { vendorId: string } }>('/api/saved/:vendorId', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    await db
      .delete(savedVendor)
      .where(and(eq(savedVendor.weddingId, ctx.wedding.id), eq(savedVendor.vendorId, request.params.vendorId)));
    return { saved: false };
  });

  /** Personal note on a saved vendor (used in comparisons, spec §6). */
  app.patch<{ Params: { vendorId: string } }>('/api/saved/:vendorId', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.vendorId)) return notFound(reply);
    const body = await parseBody(savedNoteSchema, request.body, reply);
    if (!body) return;
    const [row] = await db
      .update(savedVendor)
      .set({ note: body.note || null })
      .where(and(eq(savedVendor.weddingId, ctx.wedding.id), eq(savedVendor.vendorId, request.params.vendorId)))
      .returning();
    if (!row) return notFound(reply);
    return { note: row.note };
  });
}
