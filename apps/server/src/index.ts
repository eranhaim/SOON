import { buildApp } from './app';
import { pool } from './db';
import { env } from './env';

const app = await buildApp();

if (env.AUTH_ACCEPT_ANY_OTP) {
  app.log.warn('AUTH_ACCEPT_ANY_OTP is ON — any email code signs in. Turn off before real launch.');
}

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
