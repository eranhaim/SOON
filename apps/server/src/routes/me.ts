import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../db';
import { user } from '../db/schema';
import { requireUser } from '../session';

/** Users may only pick couple or vendor themselves; admin is granted by an admin. */
const setRoleBody = z.object({ role: z.enum(['couple', 'vendor']) });

export async function meRoutes(app: FastifyInstance) {
  /** Sets the user's role once (the choice made on the first screen). */
  app.post('/api/me/role', async (request, reply) => {
    const current = await requireUser(request, reply);
    if (!current) return;

    const parsed = setRoleBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid role' });

    const [updated] = await db
      .update(user)
      .set({ role: parsed.data.role })
      .where(and(eq(user.id, current.id), isNull(user.role)))
      .returning({ role: user.role });

    if (!updated) {
      // Role already set — not an error if it's the same one.
      const [existing] = await db.select({ role: user.role }).from(user).where(eq(user.id, current.id));
      if (existing?.role === parsed.data.role) return { role: existing.role };
      return reply.status(409).send({ error: 'Role already set' });
    }
    return { role: updated.role };
  });
}
