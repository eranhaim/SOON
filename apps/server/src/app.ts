import cors from '@fastify/cors';
import { fromNodeHeaders } from 'better-auth/node';
import { sql } from 'drizzle-orm';
import Fastify from 'fastify';

import { auth, enabledSocialProviders } from './auth';
import { db } from './db';
import { category } from './db/schema';
import { env, isDev } from './env';
import { adminRoutes } from './routes/admin';
import { boardRoutes } from './routes/boards';
import { businessRoutes } from './routes/business';
import { coupleSocialRoutes } from './routes/couple-social';
import { matchCallRoutes } from './routes/match-calls';
import { adminPanelRoutes } from './routes/admin-panel';
import { advisorRoutes } from './routes/advisor';
import { googleCalendarRoutes } from './routes/google-calendar';
import { billingRoutes, startRenewals } from './routes/billing';
import { paymentRoutes } from './routes/payments';
import { weddingSiteRoutes } from './routes/wedding-site';
import { coupleToolRoutes } from './routes/couple-tools';
import { conversationRoutes } from './routes/conversations';
import { coupleHomeRoutes } from './routes/couple-home';
import { crmRoutes } from './routes/crm';
import { demoRoutes } from './routes/demo';
import { exploreRoutes } from './routes/explore';
import { meRoutes } from './routes/me';
import { planningRoutes } from './routes/planning';
import { uploadRoutes } from './routes/uploads';
import { vendorRoutes } from './routes/vendors';
import { weddingRoutes } from './routes/weddings';

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
        const body = request.body;
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
  await app.register(uploadRoutes);
  await app.register(vendorRoutes);
  await app.register(adminRoutes);
  await app.register(weddingRoutes);
  await app.register(exploreRoutes);
  await app.register(coupleHomeRoutes);
  await app.register(planningRoutes);
  await app.register(conversationRoutes);
  await app.register(crmRoutes);
  await app.register(boardRoutes);
  await app.register(coupleToolRoutes);
  await app.register(businessRoutes);
  await app.register(coupleSocialRoutes);
  await app.register(matchCallRoutes);
  await app.register(weddingSiteRoutes);
  await app.register(paymentRoutes);
  await app.register(billingRoutes);
  await app.register(adminPanelRoutes);
  await app.register(advisorRoutes);
  await app.register(googleCalendarRoutes);
  const stopRenewals = startRenewals(app.log);
  app.addHook('onClose', async () => stopRenewals());
  if (env.DEMO_TOOLS) await app.register(demoRoutes);

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
