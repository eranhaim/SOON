/**
 * Promote an EXISTING account to admin (new accounts in ADMIN_EMAILS get it automatically).
 *   npx tsx --env-file=.env scripts/grant-admin.ts someone@example.com
 * In production:
 *   docker compose -f deploy/docker-compose.prod.yml exec server node dist/grant-admin.js someone@example.com
 */
import { eq } from 'drizzle-orm';

import { db, pool } from '../src/db';
import { user } from '../src/db/schema';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('usage: grant-admin <email>');
  process.exit(1);
}

const [row] = await db.update(user).set({ role: 'admin' }).where(eq(user.email, email)).returning({ id: user.id });
console.log(row ? `${email} is now an admin` : `No account for ${email} — sign in once first, or add it to ADMIN_EMAILS`);
await pool.end();
