/** Small reply helpers and Postgres error classifiers shared by all routes. */
import type { FastifyReply } from 'fastify';

export function badRequest(reply: FastifyReply, error: string, field?: string) {
  return reply.status(400).send({ error, field });
}

export function notFound(reply: FastifyReply, error = 'Not found') {
  return reply.status(404).send({ error });
}

export function conflict(reply: FastifyReply, error: string, extra: Record<string, unknown> = {}) {
  return reply.status(409).send({ error, ...extra });
}

function pgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: string; cause?: { code?: string } };
  // Drizzle wraps driver errors; the pg code may sit on `cause`.
  return e.code ?? e.cause?.code;
}

/** CHECK constraint violated (e.g. price range). */
export const isCheckViolation = (err: unknown) => pgCode(err) === '23514';
/** UNIQUE constraint violated. */
export const isUniqueViolation = (err: unknown) => pgCode(err) === '23505';
/** EXCLUDE constraint violated (overlapping booked calendar slots). */
export const isExclusionViolation = (err: unknown) => pgCode(err) === '23P01';

/** Fastify param guard: route params that must be UUIDs. Avoids a 500 from Postgres on junk input. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | undefined): s is string => Boolean(s && UUID_RE.test(s));
