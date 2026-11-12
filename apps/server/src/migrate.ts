/**
 * Production startup step: apply pending SQL migrations, then idempotent seeds.
 * The container runs this before starting the API (see apps/server/Dockerfile).
 */
import path from 'node:path';

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, pool } from './db';
import { seedCategories } from './db/seed-categories';

const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve('drizzle');

try {
  await migrate(db, { migrationsFolder });
  console.log('[migrate] migrations applied');
  const n = await seedCategories(db);
  console.log(`[migrate] seeded ${n} categories`);
} catch (err) {
  console.error('[migrate] failed', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
