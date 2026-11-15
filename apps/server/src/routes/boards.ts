/** Inspiration boards (spec §6): couples collect pictures by theme, optionally linked to vendors. */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import { boardCreateSchema, boardItemCreateSchema, type BoardDetailDTO, type BoardDTO } from '@soon/shared';

import { db } from '../db';
import { board, boardItem, vendor } from '../db/schema';
import { isUuid, notFound } from '../http';
import { parseBody, requireWedding } from '../session';

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=900&q=75&auto=format&fit=crop`;

/** Every wedding starts with these boards, so the screen is never empty. */
export const STARTER_BOARDS: { title: string; cover: string }[] = [
  { title: 'השמלה שלי', cover: img('1594552072238-b8a33785b261') },
  { title: 'פרחים', cover: img('1525258946800-98cfd641d0de') },
  { title: 'שולחנות ועיצוב', cover: img('1519225421980-715cb0215aed') },
  { title: 'צילום', cover: img('1511285560929-80b456fea0bc') },
  { title: 'איפור ושיער', cover: img('1487412947147-5cebf100ffc2') },
  { title: 'עוגה וקינוחים', cover: img('1535254973040-607b474cb50d') },
];

export async function ensureStarterBoards(weddingId: string) {
  const [{ n }] = (await db.select({ n: sql<number>`count(*)::int` }).from(board).where(eq(board.weddingId, weddingId))) as [{ n: number }];
  if (n > 0) return;
  await db.insert(board).values(STARTER_BOARDS.map((b, i) => ({ weddingId, title: b.title, coverUrl: b.cover, sortOrder: i })));
}

async function listBoards(weddingId: string): Promise<BoardDTO[]> {
  const rows = await db
    .select({
      id: board.id,
      title: board.title,
      coverUrl: board.coverUrl,
      // Written out in full: drizzle leaves columns unqualified in a single-table select,
      // which would make "id" bind to board_item inside the subquery.
      itemCount: sql<number>`(select count(*)::int from board_item bi where bi.board_id = "board"."id")`,
      latest: sql<string | null>`(select bi.image_url from board_item bi where bi.board_id = "board"."id" order by bi.created_at desc limit 1)`,
    })
    .from(board)
    .where(eq(board.weddingId, weddingId))
    .orderBy(asc(board.sortOrder), asc(board.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, coverUrl: r.latest ?? r.coverUrl, itemCount: r.itemCount }));
}

async function loadBoard(weddingId: string, id: string): Promise<BoardDetailDTO | null> {
  const all = await listBoards(weddingId);
  const b = all.find((x) => x.id === id);
  if (!b) return null;
  const items = await db
    .select({
      id: boardItem.id,
      imageUrl: boardItem.imageUrl,
      note: boardItem.note,
      createdAt: boardItem.createdAt,
      vendorId: vendor.id,
      vendorSlug: vendor.slug,
      vendorName: vendor.businessName,
    })
    .from(boardItem)
    .leftJoin(vendor, eq(vendor.id, boardItem.vendorId))
    .where(eq(boardItem.boardId, id))
    .orderBy(desc(boardItem.createdAt));
  return {
    ...b,
    items: items.map((i) => ({
      id: i.id,
      imageUrl: i.imageUrl,
      note: i.note,
      createdAt: i.createdAt.toISOString(),
      vendor: i.vendorId ? { id: i.vendorId, slug: i.vendorSlug!, businessName: i.vendorName! } : null,
    })),
  };
}

export async function boardRoutes(app: FastifyInstance) {
  app.get('/api/boards', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    await ensureStarterBoards(ctx.wedding.id);
    return listBoards(ctx.wedding.id);
  });

  app.post('/api/boards', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const body = await parseBody(boardCreateSchema, request.body, reply);
    if (!body) return;
    const [{ max }] = (await db
      .select({ max: sql<number>`coalesce(max(${board.sortOrder}), -1)::int` })
      .from(board)
      .where(eq(board.weddingId, ctx.wedding.id))) as [{ max: number }];
    await db.insert(board).values({ weddingId: ctx.wedding.id, title: body.title, sortOrder: max + 1 });
    return reply.status(201).send(await listBoards(ctx.wedding.id));
  });

  app.get<{ Params: { id: string } }>('/api/boards/:id', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    return (await loadBoard(ctx.wedding.id, request.params.id)) ?? notFound(reply);
  });

  app.delete<{ Params: { id: string } }>('/api/boards/:id', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    await db.delete(board).where(and(eq(board.id, request.params.id), eq(board.weddingId, ctx.wedding.id)));
    return listBoards(ctx.wedding.id);
  });

  app.post<{ Params: { id: string } }>('/api/boards/:id/items', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const body = await parseBody(boardItemCreateSchema, request.body, reply);
    if (!body) return;
    const [b] = await db
      .select({ id: board.id })
      .from(board)
      .where(and(eq(board.id, request.params.id), eq(board.weddingId, ctx.wedding.id)));
    if (!b) return notFound(reply);
    await db.insert(boardItem).values({ boardId: b.id, imageUrl: body.imageUrl, vendorId: body.vendorId ?? null, note: body.note ?? null });
    return reply.status(201).send(await loadBoard(ctx.wedding.id, b.id));
  });

  app.delete<{ Params: { id: string; itemId: string } }>('/api/boards/:id/items/:itemId', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id) || !isUuid(request.params.itemId)) return notFound(reply);
    const [b] = await db
      .select({ id: board.id })
      .from(board)
      .where(and(eq(board.id, request.params.id), eq(board.weddingId, ctx.wedding.id)));
    if (!b) return notFound(reply);
    await db.delete(boardItem).where(and(eq(boardItem.id, request.params.itemId), eq(boardItem.boardId, b.id)));
    return loadBoard(ctx.wedding.id, b.id);
  });
}
