import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';

import type { UserRole } from '@soon/shared';

import { auth } from './auth';
import { db } from './db';
import { vendor, wedding, weddingMember } from './db/schema';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role?: UserRole | null;
  bannedAt?: Date | string | null;
};

/** Returns the signed-in user, or null (no reply sent). Banned users count as signed out. */
export async function getUser(request: FastifyRequest): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  const user = (session?.user as SessionUser | undefined) ?? null;
  return user && !user.bannedAt ? user : null;
}

/** Returns the signed-in user, or sends 401 and returns null. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getUser(request);
  if (!user) {
    await reply.status(401).send({ error: 'Not signed in' });
    return null;
  }
  return user;
}

/** Signed-in user with role=vendor. Sends 401/403 and returns null otherwise. */
export async function requireVendorUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'vendor' && user.role !== 'admin') {
    await reply.status(403).send({ error: 'Vendor account required' });
    return null;
  }
  return user;
}

/** The signed-in vendor's business row. Sends 401/403/404 and returns null otherwise. */
export async function requireOwnVendor(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireVendorUser(request, reply);
  if (!user) return null;
  const [row] = await db.select().from(vendor).where(eq(vendor.ownerUserId, user.id)).limit(1);
  if (!row) {
    await reply.status(404).send({ error: 'No business yet — complete onboarding first' });
    return null;
  }
  return { user, vendor: row };
}

/** Parses with a zod schema; on failure sends 400 with the first issue and returns null. */
export async function parseBody<S extends z.ZodType>(
  schema: S,
  body: unknown,
  reply: FastifyReply,
): Promise<z.infer<S> | null> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    await reply.status(400).send({
      error: issue?.message ?? 'Invalid input',
      field: issue?.path.join('.') || undefined,
    });
    return null;
  }
  return parsed.data;
}

/** Signed-in admin. Sends 401/403 and returns null otherwise. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'admin') {
    await reply.status(403).send({ error: 'Admin only' });
    return null;
  }
  return user;
}

/** Signed-in user with role=couple. Sends 401/403 and returns null otherwise. */
export async function requireCoupleUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireUser(request, reply);
  if (!user) return null;
  if (user.role !== 'couple') {
    await reply.status(403).send({ error: 'Couple account required' });
    return null;
  }
  return user;
}

export type WeddingRow = typeof wedding.$inferSelect;

/** The wedding a user belongs to (as partner), or null. */
export async function findWeddingForUser(userId: string): Promise<WeddingRow | null> {
  const [row] = await db
    .select({ wedding })
    .from(weddingMember)
    .innerJoin(wedding, eq(wedding.id, weddingMember.weddingId))
    .where(eq(weddingMember.userId, userId))
    .limit(1);
  return row?.wedding ?? null;
}

/** The signed-in couple's wedding. Sends 401/403/404 and returns null otherwise. */
export async function requireWedding(request: FastifyRequest, reply: FastifyReply) {
  const user = await requireCoupleUser(request, reply);
  if (!user) return null;
  const row = await findWeddingForUser(user.id);
  if (!row) {
    await reply.status(404).send({ error: 'No wedding yet — complete onboarding first' });
    return null;
  }
  return { user, wedding: row };
}
