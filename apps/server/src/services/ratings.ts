/** Rating aggregates over published reviews, correlated on `vendor` (spec §5 cards, §17). */
import { sql } from 'drizzle-orm';

import { review, vendor } from '../db/schema';

export function ratingSummarySql() {
  const published = sql`${review.vendorId} = ${vendor.id} and ${review.status} = 'published'`;
  return {
    avg: sql<number | null>`(select round(avg(${review.rating})::numeric, 1) from ${review} where ${published})`,
    count: sql<number>`(select count(*)::int from ${review} where ${published})`,
  };
}
