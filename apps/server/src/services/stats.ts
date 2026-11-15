/** Vendor analytics counters (spec §9). Best-effort: a failed counter never fails a request. */
import { sql } from 'drizzle-orm';

import { todayIso } from '@soon/shared';

import { db } from '../db';
import { vendorStatDaily } from '../db/schema';

export async function countProfileView(vendorId: string) {
  await db
    .insert(vendorStatDaily)
    .values({ vendorId, day: todayIso(), views: 1 })
    .onConflictDoUpdate({
      target: [vendorStatDaily.vendorId, vendorStatDaily.day],
      set: { views: sql`${vendorStatDaily.views} + 1` },
    })
    .catch(() => undefined);
}
