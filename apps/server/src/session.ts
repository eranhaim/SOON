import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { auth } from './auth';

/** Returns the signed-in user, or sends 401 and returns null. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
  if (!session) {
    await reply.status(401).send({ error: 'Not signed in' });
    return null;
  }
  return session.user;
}
