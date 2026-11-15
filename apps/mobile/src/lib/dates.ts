import { APP_TIME_ZONE } from '@soon/shared';

const tz = { timeZone: APP_TIME_ZONE } as const;
const dateFmt = new Intl.DateTimeFormat('he-IL', { ...tz, day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('he-IL', { ...tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('he-IL', { ...tz, hour: '2-digit', minute: '2-digit' });
// Civil dates (YYYY-MM-DD) are formatted in UTC so they never shift a day.
const civilFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const civilShortFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', month: 'long', year: 'numeric' });

const civil = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** An instant (ISO timestamp) → "17 ביוני 2027". */
export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : '');
export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : '');
export const formatTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : '');

/** A civil date (YYYY-MM-DD) → "17 ביוני 2027". */
export const formatDay = (iso: string | null | undefined) => (iso ? civilFmt.format(civil(iso)) : '');
/** A civil date → "יום ה׳, 17 ביוני". */
export const formatDayShort = (iso: string | null | undefined) => (iso ? civilShortFmt.format(civil(iso)) : '');
export const formatMonth = (iso: string) => monthFmt.format(civil(iso));

/** Israeli local date + "HH:MM" → ISO instant with the right offset (handles DST). */
export function toInstant(date: string, time: string): string {
  const [h, m] = time.split(':').map(Number);
  // Find the offset Israel had at that wall-clock time.
  const guess = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  const local = new Date(guess.toLocaleString('en-US', tz));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (local.getTime() - utc.getTime())).toISOString();
}

/** Valid 24h "HH:MM". */
export const isTime = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s.trim());

/** "בוקר טוב" / "צהריים טובים" / "ערב טוב" / "לילה טוב" by local hour (spec §9 greeting). */
export function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-US', { ...tz, hour: 'numeric', hourCycle: 'h23' }).format(date));
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  if (h >= 17 && h < 22) return 'ערב טוב';
  return 'לילה טוב';
}
