/**
 * Demo tools for customer presentations. Only registered when DEMO_TOOLS=true.
 * Reset is limited to demo accounts (…@demo.soon): real accounts are never touched.
 */
import type { FastifyInstance } from 'fastify';

import { seedDemo } from '../db/demo-data';
import { getUser } from '../session';

let running: Promise<string> | null = null;

export async function demoRoutes(app: FastifyInstance) {
  app.post('/api/demo/reset', async (request, reply) => {
    const u = await getUser(request);
    if (!u?.email.endsWith('@demo.soon')) return reply.status(403).send({ error: 'Demo accounts only' });
    // One reset at a time; a second click waits for the first.
    running ??= seedDemo().finally(() => (running = null));
    const summary = await running;
    request.log.info({ summary }, 'demo data reset');
    return { ok: true };
  });
}
