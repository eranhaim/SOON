import cors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';

import { ANY_OTP_CODE, auth, enabledSocialProviders } from './auth';
import { db } from './db';
import { category } from './db/schema';
import { env, isDev } from './env';
import { meRoutes } from './routes/me';

/** Better Auth endpoints that check an email code. */
const OTP_CHECK_PATHS = new Set(['/api/auth/sign-in/email-otp', '/api/auth/email-otp/verify-email']);

export async function buildApp() {
  const app = Fastify({
    logger: { level: isDev ? 'debug' : 'info' },
    trustProxy: true, // behind Caddy in production
  });

  await app.register(cors, {
    origin: env.WEB_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  // ---- Better Auth: hand /api/auth/* to its Web-standard handler ----
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      try {
        const url = new URL(request.url, `${request.protocol}://${request.headers.host}`);
        let body = request.body;
        if (env.AUTH_ACCEPT_ANY_OTP && request.method === 'POST' && OTP_CHECK_PATHS.has(url.pathname)) {
          // Dev shortcut: replace the typed code with the fixed internal one (see auth.ts).
          body = { ...(body as object), otp: ANY_OTP_CODE };
        }
        const req = new Request(url.toString(), {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const response = await auth.handler(req);
        reply.status(response.status);
        response.headers.forEach((value, key) => reply.header(key, value));
        return reply.send(response.body ? await response.text() : null);
      } catch (err) {
        request.log.error(err, 'auth handler failed');
        return reply.status(500).send({ error: 'Internal authentication error' });
      }
    },
  });

  await app.register(meRoutes);

  // ---- Health / meta ----
  app.get('/health', async () => {
    await db.execute(sql`select 1`);
    return { ok: true };
  });

  /** Lets the app know which sign-in buttons to show. */
  app.get('/api/meta', async () => ({ authProviders: enabledSocialProviders }));

  app.get('/api/categories', async () =>
    db
      .select({ slug: category.slug, label: category.labelHe })
      .from(category)
      .where(sql`${category.active} = true`)
      .orderBy(category.sortOrder),
  );

  return app;
}
