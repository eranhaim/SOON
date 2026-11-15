/**
 * Set (or reset) the email+password login of an EXISTING account.
 *   npx tsx --env-file=.env scripts/set-password.ts someone@example.com <password>
 * In production:
 *   docker compose -f deploy/docker-compose.prod.yml exec server node dist/set-password.js someone@example.com <password>
 */
import { randomUUID } from 'node:crypto';

import { hashPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';

import { db, pool } from '../src/db';
import { account, user } from '../src/db/schema';

const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
if (!email || !password || password.length < 6) {
  console.error('usage: set-password <email> <password (6+ chars)>');
  process.exit(1);
}

const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
if (!row) {
  console.error(`No account for ${email}`);
  await pool.end();
  process.exit(1);
}

const hash = await hashPassword(password);
const where = and(eq(account.userId, row.id), eq(account.providerId, 'credential'));
const [existing] = await db.select({ id: account.id }).from(account).where(where);
if (existing) {
  await db.update(account).set({ password: hash }).where(where);
} else {
  await db.insert(account).values({
    id: randomUUID(), userId: row.id, accountId: row.id, providerId: 'credential', password: hash, updatedAt: new Date(),
  });
}
console.log(`Password set for ${email}`);
await pool.end();
