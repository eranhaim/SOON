/**
 * CLI: fill the DB with demo data (see demo-data.ts).
 *   npm run db:seed:demo -w @soon/server
 * On the demo server (NODE_ENV=production) it needs --force:
 *   docker compose -f deploy/docker-compose.prod.yml exec server node dist/seed-demo.js --force
 */
import { env } from '../env';
import { DEMO_PASSWORD, seedDemo } from './demo-data';
import { pool } from './index';

if (env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
  console.error('Refusing to seed demo data in production. Pass --force on a demo server.');
  process.exit(1);
}

try {
  console.log(await seedDemo());
  console.log(`Sign in as couple@demo.soon or vendor@demo.soon, password ${DEMO_PASSWORD}.`);
} finally {
  await pool.end();
}
