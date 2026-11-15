/**
 * Calendar-date helpers on plain `YYYY-MM-DD` strings. Dates are civil (Israeli) days,
 * never instants, so arithmetic is done in UTC to dodge DST shifts.
 */
export const APP_TIME_ZONE = 'Asia/Jerusalem';

const isoFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date in Israel as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  return isoFmt.format(now);
}

/** The Israeli civil date of an instant. */
export function isoDateOf(instant: Date | string): string {
  return isoFmt.format(typeof instant === 'string' ? new Date(instant) : instant);
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
};

export function addDays(iso: string, days: number): string {
  return new Date(toUtc(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function maxIso(a: string, b: string) {
  return a > b ? a : b;
}

/** First day of the month containing `iso`, and the number of days in it. */
export function monthInfo(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const days = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  /** 0 = Sunday (the Israeli week starts on Sunday). */
  const weekday = new Date(toUtc(first)).getUTCDay();
  return { first, days, weekday, year: y!, month: m! };
}

export function addMonths(iso: string, months: number): string {
  const [y, m] = iso.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}
