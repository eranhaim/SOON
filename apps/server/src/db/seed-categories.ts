import { sql } from 'drizzle-orm';

import { VENDOR_CATEGORIES } from '@soon/shared';

import type { DB } from './index';
import { category } from './schema';

/** Idempotent: upserts the initial category list. Safe to run on every deploy. */
export async function seedCategories(db: DB) {
  await db
    .insert(category)
    .values(VENDOR_CATEGORIES.map((c, i) => ({ slug: c.slug, labelHe: c.he, sortOrder: i })))
    .onConflictDoUpdate({
      target: category.slug,
      set: { labelHe: sql`excluded.label_he`, sortOrder: sql`excluded.sort_order` },
    });
  return VENDOR_CATEGORIES.length;
}
