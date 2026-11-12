/** Idempotent seed: upserts the initial category list. Safe to re-run. */
import { sql } from 'drizzle-orm';

import { VENDOR_CATEGORIES } from '@soon/shared';

import { db, pool } from './index';
import { category } from './schema';

async function main() {
  await db
    .insert(category)
    .values(VENDOR_CATEGORIES.map((c, i) => ({ slug: c.slug, labelHe: c.he, sortOrder: i })))
    .onConflictDoUpdate({
      target: category.slug,
      set: { labelHe: sql`excluded.label_he`, sortOrder: sql`excluded.sort_order` },
    });
  console.log(`Seeded ${VENDOR_CATEGORIES.length} categories.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
