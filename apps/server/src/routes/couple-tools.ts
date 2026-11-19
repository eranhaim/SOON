/** Couple planning tools added in round 2: the wedding playlist and the AI invitation. */
import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  invitationRequestSchema,
  invitationSaveSchema,
  songInputSchema,
  songOrderSchema,
  type InvitationDTO,
  type SongDTO,
} from '@soon/shared';

import { db } from '../db';
import { wedding, weddingSong } from '../db/schema';
import { isUuid, notFound } from '../http';
import { writeInvitation } from '../services/invitation';
import { parseBody, requireWedding } from '../session';

async function listSongs(weddingId: string): Promise<SongDTO[]> {
  const rows = await db
    .select()
    .from(weddingSong)
    .where(eq(weddingSong.weddingId, weddingId))
    .orderBy(asc(weddingSong.stage), asc(weddingSong.sortOrder), asc(weddingSong.createdAt));
  return rows.map((r) => ({
    id: r.id,
    stage: r.stage as SongDTO['stage'],
    title: r.title,
    artist: r.artist,
    url: r.url,
    note: r.note,
  }));
}

export async function coupleToolRoutes(app: FastifyInstance) {
  // ----- playlist -----
  app.get('/api/planning/playlist', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return listSongs(ctx.wedding.id);
  });

  app.post('/api/planning/playlist', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(songInputSchema, request.body, reply);
    if (!b) return;
    const [{ max }] = (await db
      .select({ max: sql<number>`coalesce(max(${weddingSong.sortOrder}), -1)::int` })
      .from(weddingSong)
      .where(and(eq(weddingSong.weddingId, ctx.wedding.id), eq(weddingSong.stage, b.stage)))) as [{ max: number }];
    await db.insert(weddingSong).values({
      weddingId: ctx.wedding.id,
      stage: b.stage,
      title: b.title,
      artist: b.artist || null,
      url: b.url || null,
      note: b.note || null,
      sortOrder: max + 1,
    });
    return reply.status(201).send(await listSongs(ctx.wedding.id));
  });

  app.patch<{ Params: { id: string } }>('/api/planning/playlist/:id', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    const b = await parseBody(songInputSchema.partial(), request.body, reply);
    if (!b) return;
    const set: Partial<typeof weddingSong.$inferInsert> = {};
    if (b.stage !== undefined) set.stage = b.stage;
    if (b.title !== undefined) set.title = b.title;
    if (b.artist !== undefined) set.artist = b.artist || null;
    if (b.url !== undefined) set.url = b.url || null;
    if (b.note !== undefined) set.note = b.note || null;
    if (Object.keys(set).length) {
      await db
        .update(weddingSong)
        .set(set)
        .where(and(eq(weddingSong.id, request.params.id), eq(weddingSong.weddingId, ctx.wedding.id)));
    }
    return listSongs(ctx.wedding.id);
  });

  app.delete<{ Params: { id: string } }>('/api/planning/playlist/:id', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    if (!isUuid(request.params.id)) return notFound(reply);
    await db.delete(weddingSong).where(and(eq(weddingSong.id, request.params.id), eq(weddingSong.weddingId, ctx.wedding.id)));
    return listSongs(ctx.wedding.id);
  });

  /** Reorder the songs of one stage (ids in the new order). */
  app.put('/api/planning/playlist/order', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(songOrderSchema, request.body, reply);
    if (!b) return;
    await db.transaction(async (tx) => {
      for (const [i, id] of b.ids.entries()) {
        await tx
          .update(weddingSong)
          .set({ sortOrder: i })
          .where(and(eq(weddingSong.id, id), eq(weddingSong.weddingId, ctx.wedding.id), eq(weddingSong.stage, b.stage)));
      }
    });
    return listSongs(ctx.wedding.id);
  });

  // ----- AI invitation -----
  app.get('/api/planning/invitation', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return { invitation: ctx.wedding.invitation ?? null };
  });

  /** Writes a new invitation text (Claude when configured, else the built-in writer). Not saved. */
  app.post('/api/planning/invitation/generate', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(invitationRequestSchema, request.body, reply);
    if (!b) return;
    const invitation = await writeInvitation(b, request.log);
    return invitation;
  });

  app.put('/api/planning/invitation', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(invitationSaveSchema, request.body, reply);
    if (!b) return;
    const invitation: InvitationDTO = b;
    await db.update(wedding).set({ invitation }).where(eq(wedding.id, ctx.wedding.id));
    return { invitation };
  });
}
