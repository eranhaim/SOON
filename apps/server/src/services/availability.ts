/**
 * Availability rules (spec §5, §11, §20).
 *
 * Source of truth is the vendor's own calendar (availability_entry). A date counts as:
 *   booked    — any `booked` or `unavailable` entry overlaps that Israeli calendar day
 *   available — the vendor explicitly marked the day `available`
 *   unknown   — nothing on the calendar (availability depends on the vendor keeping it updated)
 * `pending` entries (tentative holds) don't block a date for couples.
 */
import { sql, type SQL } from 'drizzle-orm';

import type { DayAvailability } from '@soon/shared';

import { availabilityEntry, vendor } from '../db/schema';

export const APP_TIME_ZONE = 'Asia/Jerusalem';

/** SQL for the [start, end) instants of an Israeli calendar day given as YYYY-MM-DD. */
export function dayBounds(date: string) {
  return {
    start: sql`((${date})::date::timestamp at time zone ${APP_TIME_ZONE})`,
    end: sql`(((${date})::date + 1)::timestamp at time zone ${APP_TIME_ZONE})`,
  };
}

function entryOnDay(date: string, statuses: string[]): SQL {
  const { start, end } = dayBounds(date);
  return sql`exists (
    select 1 from ${availabilityEntry}
    where ${availabilityEntry.vendorId} = ${vendor.id}
      and ${availabilityEntry.status} in (${sql.join(
        statuses.map((s) => sql`${s}`),
        sql`, `,
      )})
      and ${availabilityEntry.startsAt} < ${end}
      and ${availabilityEntry.endsAt} > ${start}
  )`;
}

/** Correlated on `vendor`: is this vendor busy on `date`? */
export const vendorBusyOn = (date: string) => entryOnDay(date, ['booked', 'unavailable']);

/** Correlated on `vendor`: the DayAvailability of this vendor on `date`. */
export function vendorAvailabilityOn(date: string): SQL<DayAvailability> {
  return sql<DayAvailability>`case
    when ${vendorBusyOn(date)} then 'booked'
    when ${entryOnDay(date, ['available'])} then 'available'
    else 'unknown' end`;
}
