/** Couple planning knowledge (spec §7): checklist timeline, budget split, alcohol estimate. */
import type { VendorCategorySlug } from './categories';

// ---------- checklist (spec §7.1) ----------

export type ChecklistTemplate = {
  key: string;
  title: string;
  /** Due this many days before the wedding. */
  daysBefore: number;
  /** Booking tasks: done automatically when the couple marks the category closed. */
  closesCategory?: VendorCategorySlug;
};

/** Phases from the spec: 12–9 months, 8–6 months, 3 months, a month, a week, the day. */
export const CHECKLIST_PHASES = [
  { key: 'm12', label: '12–9 חודשים לפני', fromDays: 270 },
  { key: 'm8', label: '8–6 חודשים לפני', fromDays: 180 },
  { key: 'm3', label: '3 חודשים לפני', fromDays: 60 },
  { key: 'm1', label: 'חודש לפני', fromDays: 8 },
  { key: 'w1', label: 'שבוע לפני', fromDays: 1 },
  { key: 'd0', label: 'יום החתונה', fromDays: 0 },
] as const;

export function checklistPhaseFor(daysBefore: number) {
  return CHECKLIST_PHASES.find((p) => daysBefore >= p.fromDays) ?? CHECKLIST_PHASES[CHECKLIST_PHASES.length - 1]!;
}

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  // 12–9 months
  { key: 'budget', title: 'לקבוע תקציב כולל ולחלק לקטגוריות', daysBefore: 365 },
  { key: 'guest-draft', title: 'טיוטה ראשונה של רשימת מוזמנים', daysBefore: 350 },
  { key: 'venue', title: 'לסגור אולם / גן אירועים', daysBefore: 330, closesCategory: 'venue' },
  { key: 'production', title: 'להחליט אם לקחת מפיקה', daysBefore: 320, closesCategory: 'production' },
  { key: 'photography', title: 'לסגור צלם סטילס', daysBefore: 300, closesCategory: 'photography' },
  { key: 'video', title: 'לסגור צלם וידאו', daysBefore: 290, closesCategory: 'video' },
  { key: 'dj', title: 'לסגור DJ', daysBefore: 280, closesCategory: 'dj' },
  { key: 'officiant', title: 'לבחור רב / עורך חופה', daysBefore: 270, closesCategory: 'officiant' },
  // 8–6 months
  { key: 'dress', title: 'לבחור שמלת כלה', daysBefore: 240, closesCategory: 'dresses' },
  { key: 'design', title: 'לסגור עיצוב אירוע ופרחים', daysBefore: 220, closesCategory: 'design' },
  { key: 'social', title: 'לסגור צילום סושיאל', daysBefore: 210, closesCategory: 'social' },
  { key: 'makeup', title: 'לסגור מאפרת', daysBefore: 200, closesCategory: 'makeup' },
  { key: 'hair', title: 'לסגור מעצבת שיער', daysBefore: 195, closesCategory: 'hair' },
  { key: 'suit', title: 'לבחור חליפת חתן', daysBefore: 180, closesCategory: 'suits' },
  { key: 'rabbinate', title: 'לפתוח תיק נישואין ברבנות', daysBefore: 180 },
  // 3 months
  { key: 'rings', title: 'לבחור טבעות', daysBefore: 100, closesCategory: 'rings' },
  { key: 'invitations', title: 'לעצב ולהזמין הזמנות', daysBefore: 90, closesCategory: 'invitations' },
  { key: 'alcohol', title: 'לתכנן אלכוהול ובר', daysBefore: 80, closesCategory: 'alcohol' },
  { key: 'transport', title: 'לסגור הסעות לאורחים', daysBefore: 75, closesCategory: 'transportation' },
  { key: 'trial', title: 'ניסיון איפור ושיער', daysBefore: 70 },
  { key: 'rsvp', title: 'לסגור אישורי הגעה', daysBefore: 60, closesCategory: 'rsvp' },
  // a month
  { key: 'send-invites', title: 'לשלוח הזמנות', daysBefore: 45 },
  { key: 'seating', title: 'סידורי שולחנות', daysBefore: 21 },
  { key: 'mikveh', title: 'לתאם מקווה', daysBefore: 14 },
  { key: 'timeline', title: 'לבנות לוח זמנים ליום החתונה', daysBefore: 14 },
  { key: 'final-payments', title: 'לרכז תשלומים אחרונים לספקים', daysBefore: 10 },
  // a week
  { key: 'confirm-vendors', title: 'אישור סופי מול כל הספקים', daysBefore: 7 },
  { key: 'final-count', title: 'מספר מוזמנים סופי לאולם', daysBefore: 5 },
  { key: 'bag', title: 'להכין תיק ליום החתונה', daysBefore: 2 },
  // the day
  { key: 'enjoy', title: 'לנשום עמוק וליהנות', daysBefore: 0 },
];

// ---------- budget (spec §7.2) ----------

export type BudgetCategory = {
  key: string;
  label: string;
  /** Matching SOON vendor category, for linking booked vendors. */
  vendorCategory?: VendorCategorySlug;
  /** Suggested share of the total budget, in percent. */
  suggestedPct: number;
};

export const BUDGET_CATEGORIES: BudgetCategory[] = [
  { key: 'venue', label: 'אולם', vendorCategory: 'venue', suggestedPct: 45 },
  { key: 'photography', label: 'צילום', vendorCategory: 'photography', suggestedPct: 10 },
  { key: 'social', label: 'סושיאל', vendorCategory: 'social', suggestedPct: 3 },
  { key: 'dj', label: 'DJ', vendorCategory: 'dj', suggestedPct: 6 },
  { key: 'dress', label: 'שמלה', vendorCategory: 'dresses', suggestedPct: 6 },
  { key: 'makeup', label: 'איפור', vendorCategory: 'makeup', suggestedPct: 2 },
  { key: 'hair', label: 'שיער', vendorCategory: 'hair', suggestedPct: 1.5 },
  { key: 'flowers', label: 'פרחים', vendorCategory: 'flowers', suggestedPct: 4 },
  { key: 'design', label: 'עיצוב', vendorCategory: 'design', suggestedPct: 6 },
  { key: 'alcohol', label: 'אלכוהול', vendorCategory: 'alcohol', suggestedPct: 6 },
  { key: 'invitations', label: 'הזמנות', vendorCategory: 'invitations', suggestedPct: 1 },
  { key: 'transportation', label: 'הסעות', vendorCategory: 'transportation', suggestedPct: 2 },
  { key: 'other', label: 'אחר', suggestedPct: 7.5 },
];
export const BUDGET_CATEGORY_KEYS = BUDGET_CATEGORIES.map((c) => c.key) as [string, ...string[]];

export function budgetCategoryLabel(key: string) {
  return BUDGET_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** The budget line a SOON vendor category belongs to ("other" when there's no match). */
export function budgetCategoryForVendor(slug: string) {
  return BUDGET_CATEGORIES.find((c) => c.vendorCategory === slug)?.key ?? 'other';
}

// ---------- alcohol calculator (spec §7.3) ----------
// An estimate, not a commitment — the UI must say so.

export const ALCOHOL_EVENT_PROFILES = [
  { key: 'light', label: 'קהל מתון / אירוע צהריים', drinksPerDrinker: 3 },
  { key: 'classic', label: 'חתונת ערב קלאסית', drinksPerDrinker: 4.5 },
  { key: 'party', label: 'קהל צעיר שאוהב לחגוג', drinksPerDrinker: 6.5 },
] as const;
export type AlcoholEventProfile = (typeof ALCOHOL_EVENT_PROFILES)[number]['key'];

export const ALCOHOL_DRINKS = [
  { key: 'wine', label: 'יין', unit: 'בקבוקים', servingsPerUnit: 5, weight: 30 },
  { key: 'beer', label: 'בירה', unit: 'בקבוקים', servingsPerUnit: 1, weight: 25 },
  { key: 'vodka', label: 'וודקה', unit: 'בקבוקי 700 מ"ל', servingsPerUnit: 16, weight: 20 },
  { key: 'whisky', label: 'וויסקי', unit: 'בקבוקי 700 מ"ל', servingsPerUnit: 16, weight: 15 },
  { key: 'arak', label: 'ערק', unit: 'בקבוקי 700 מ"ל', servingsPerUnit: 16, weight: 10 },
] as const;
export type AlcoholDrink = (typeof ALCOHOL_DRINKS)[number]['key'];

export type AlcoholInput = {
  guests: number;
  /** Share of guests who drink, 0–100. */
  drinkingPct: number;
  profile: AlcoholEventProfile;
  drinks: AlcoholDrink[];
};

export type AlcoholEstimate = {
  drinkers: number;
  totalServings: number;
  lines: { key: AlcoholDrink; label: string; unit: string; units: number; servings: number }[];
};

/** Servings split by popularity weight among the chosen drinks, +10% safety margin. */
export function estimateAlcohol(input: AlcoholInput): AlcoholEstimate {
  const guests = Math.max(0, Math.floor(input.guests || 0));
  const pct = Math.min(100, Math.max(0, input.drinkingPct || 0));
  const drinkers = Math.round((guests * pct) / 100);
  const profile = ALCOHOL_EVENT_PROFILES.find((p) => p.key === input.profile) ?? ALCOHOL_EVENT_PROFILES[1];
  const totalServings = Math.ceil(drinkers * profile.drinksPerDrinker * 1.1);
  const chosen = ALCOHOL_DRINKS.filter((d) => input.drinks.includes(d.key));
  const weightSum = chosen.reduce((s, d) => s + d.weight, 0) || 1;
  return {
    drinkers,
    totalServings,
    lines: chosen.map((d) => {
      const servings = Math.round((totalServings * d.weight) / weightSum);
      return { key: d.key, label: d.label, unit: d.unit, servings, units: Math.ceil(servings / d.servingsPerUnit) };
    }),
  };
}
