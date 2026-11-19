/**
 * Gregorian civil date → Hebrew date in Hebrew letters ("י״א בסיון תשפ״ז").
 * Pure arithmetic (the classic molad / dehiyyot algorithm), so it works the same on
 * the server, on the web and in Hermes, which may not ship the Hebrew Intl calendar.
 */

const EPOCH = -1373428; // R.D. of the Hebrew epoch, offset so 1 Tishrei AM 1 = elapsedDays(1) + EPOCH
const NISAN = 1;
const ADAR_I = 12;
const ADAR_II = 13;
const TISHREI = 7;

const isLeap = (y: number) => (1 + y * 7) % 19 < 7;
const monthsInYear = (y: number) => (isLeap(y) ? 13 : 12);

const elapsedCache = new Map<number, number>();
function elapsedDays(year: number): number {
  const cached = elapsedCache.get(year);
  if (cached != null) return cached;
  const prev = year - 1;
  const mElapsed = 235 * Math.floor(prev / 19) + 12 * (prev % 19) + Math.floor(((prev % 19) * 7 + 1) / 19);
  const pElapsed = 204 + 793 * (mElapsed % 1080);
  const hElapsed = 5 + 12 * mElapsed + 793 * Math.floor(mElapsed / 1080) + Math.floor(pElapsed / 1080);
  const parts = (pElapsed % 1080) + 1080 * (hElapsed % 24);
  const day = 1 + 29 * mElapsed + Math.floor(hElapsed / 24);
  let alt = day;
  if (parts >= 19440 || (day % 7 === 2 && parts >= 9924 && !isLeap(year)) || (day % 7 === 1 && parts >= 16789 && isLeap(year - 1))) alt++;
  if (alt % 7 === 0 || alt % 7 === 3 || alt % 7 === 5) alt++;
  elapsedCache.set(year, alt);
  return alt;
}

const daysInYear = (y: number) => elapsedDays(y + 1) - elapsedDays(y);

function daysInMonth(month: number, year: number): number {
  switch (month) {
    case 2: // Iyar
    case 4: // Tamuz
    case 6: // Elul
    case 10: // Tevet
    case ADAR_II:
      return 29;
    case 8: // Cheshvan: long in "complete" years
      return daysInYear(year) % 10 === 5 ? 30 : 29;
    case 9: // Kislev: short in "deficient" years
      return daysInYear(year) % 10 === 3 ? 29 : 30;
    case ADAR_I:
      return isLeap(year) ? 30 : 29;
    default:
      return 30;
  }
}

function hebrewToAbs(year: number, month: number, day: number): number {
  let total = day;
  if (month < TISHREI) {
    for (let m = TISHREI; m <= monthsInYear(year); m++) total += daysInMonth(m, year);
    for (let m = NISAN; m < month; m++) total += daysInMonth(m, year);
  } else {
    for (let m = TISHREI; m < month; m++) total += daysInMonth(m, year);
  }
  return EPOCH + elapsedDays(year) + total - 1;
}

function absToHebrew(abs: number): { year: number; month: number; day: number } {
  let year = Math.floor((abs - EPOCH) / 365.24682220597794);
  while (EPOCH + elapsedDays(year + 1) <= abs) year++;
  let month = abs < hebrewToAbs(year, NISAN, 1) ? TISHREI : NISAN;
  while (abs > hebrewToAbs(year, month, daysInMonth(month, year))) month = (month % monthsInYear(year)) + 1;
  return { year, month, day: 1 + abs - hebrewToAbs(year, month, 1) };
}

const MONTHS: Record<number, string> = {
  1: 'ניסן',
  2: 'אייר',
  3: 'סיון',
  4: 'תמוז',
  5: 'אב',
  6: 'אלול',
  7: 'תשרי',
  8: 'חשון',
  9: 'כסלו',
  10: 'טבת',
  11: 'שבט',
  12: 'אדר',
  13: 'אדר ב׳',
};

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת'];

/** 1..999 in Hebrew letters with geresh / gershayim ("ט״ו", "תשפ״ז", "ה׳"). */
export function gematriya(n: number): string {
  let rest = n % 1000;
  let s = '';
  while (rest >= 400) {
    s += 'ת';
    rest -= 400;
  }
  if (rest >= 100) {
    s += HUNDREDS[Math.floor(rest / 100)];
    rest %= 100;
  }
  if (rest === 15) s += 'טו';
  else if (rest === 16) s += 'טז';
  else s += TENS[Math.floor(rest / 10)]! + ONES[rest % 10]!;
  return s.length === 1 ? `${s}׳` : `${s.slice(0, -1)}״${s.slice(-1)}`;
}

/** "YYYY-MM-DD" (civil date) → { day, month name, year } in the Hebrew calendar. */
export function toHebrewDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  // R.D. (days since 0001-01-01, day 1) via the Unix epoch: 1970-01-01 is R.D. 719163.
  const abs = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000) + 719_163;
  const h = absToHebrew(abs);
  const monthName = h.month === ADAR_I && isLeap(h.year) ? 'אדר א׳' : MONTHS[h.month]!;
  return { day: h.day, month: h.month, monthName, year: h.year };
}

/** "2027-06-17" → "י״א בסיון תשפ״ז". */
export function formatHebrewDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const h = toHebrewDate(iso);
  return `${gematriya(h.day)} ב${h.monthName} ${gematriya(h.year)}`;
}
