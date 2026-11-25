/**
 * Definitions for the second round of features: wedding playlist, AI invitation,
 * vendor statistics, finances, client documents, subscription plans and settings.
 */
import { z } from 'zod';

// ---------- wedding playlist ----------
export const PLAYLIST_STAGES = [
  { key: 'reception', label: 'קבלת פנים' },
  { key: 'chuppah_entry', label: 'כניסה לחופה' },
  { key: 'chuppah_exit', label: 'שבירת הכוס ויציאה מהחופה' },
  { key: 'first_dance', label: 'ריקוד ראשון' },
  { key: 'dancing', label: 'רחבה' },
  { key: 'closing', label: 'סיום הערב' },
] as const;
export type PlaylistStage = (typeof PLAYLIST_STAGES)[number]['key'];
export const PLAYLIST_STAGE_KEYS = PLAYLIST_STAGES.map((s) => s.key) as [PlaylistStage, ...PlaylistStage[]];

export type SongDTO = {
  id: string;
  stage: PlaylistStage;
  title: string;
  artist: string | null;
  url: string | null;
  note: string | null;
};

export const songInputSchema = z.object({
  stage: z.enum(PLAYLIST_STAGE_KEYS),
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().max(160).nullable().optional(),
  url: z.url().max(1000).nullable().optional().or(z.literal('').transform(() => null)),
  note: z.string().trim().max(500).nullable().optional(),
});
export const songOrderSchema = z.object({ stage: z.enum(PLAYLIST_STAGE_KEYS), ids: z.array(z.uuid()).max(200) });

// ---------- AI invitation ----------
export const INVITATION_STYLES = [
  { key: 'classic', label: 'קלאסי' },
  { key: 'modern', label: 'מודרני' },
  { key: 'romantic', label: 'רומנטי' },
  { key: 'minimal', label: 'מינימליסטי' },
] as const;
export type InvitationStyle = (typeof INVITATION_STYLES)[number]['key'];

export const invitationRequestSchema = z.object({
  style: z.enum(['classic', 'modern', 'romantic', 'minimal']),
  partner1Name: z.string().trim().min(1).max(80),
  partner2Name: z.string().trim().min(1).max(80),
  partner1Parents: z.string().trim().max(160).optional().default(''),
  partner2Parents: z.string().trim().max(160).optional().default(''),
  weddingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  hebrewDate: z.string().max(60).optional().default(''),
  venueName: z.string().trim().max(120).optional().default(''),
  receptionTime: z.string().trim().max(10).optional().default(''),
  chuppahTime: z.string().trim().max(10).optional().default(''),
  extra: z.string().trim().max(400).optional().default(''),
});
export type InvitationRequest = z.infer<typeof invitationRequestSchema>;

export type InvitationDTO = {
  style: InvitationStyle;
  /** Opening line above the names, e.g. "בשמחה רבה ובהתרגשות". */
  opening: string;
  /** Main text between the names and the details. */
  body: string;
  /** Closing line, e.g. "נשמח לחגוג איתכם". */
  closing: string;
  request: InvitationRequest;
  /** 'ai' when written by the model, 'template' for the built-in writer. */
  source: 'ai' | 'template';
};

export const invitationSaveSchema = z.object({
  style: z.enum(['classic', 'modern', 'romantic', 'minimal']),
  opening: z.string().trim().max(200),
  body: z.string().trim().max(1200),
  closing: z.string().trim().max(200),
  request: invitationRequestSchema,
  source: z.enum(['ai', 'template']),
});

// ---------- vendor statistics ----------
export type VendorWeekStat = {
  /** Sunday of the week, YYYY-MM-DD. */
  weekStart: string;
  views: number;
  saves: number;
  inquiries: number;
  deals: number;
};

export type VendorStatsDTO = {
  weeks: VendorWeekStat[];
  totals: { views: number; saves: number; inquiries: number; deals: number };
  /** Percent, 0..100, one decimal. Null when the base is zero. */
  viewToInquiry: number | null;
  inquiryToDeal: number | null;
};

// ---------- finances ----------
export const EXPENSE_CATEGORIES = [
  { key: 'equipment', label: 'ציוד' },
  { key: 'travel', label: 'נסיעות ודלק' },
  { key: 'marketing', label: 'שיווק ופרסום' },
  { key: 'staff', label: 'עובדים ועוזרים' },
  { key: 'software', label: 'תוכנות ומנויים' },
  { key: 'office', label: 'משרד וסטודיו' },
  { key: 'other', label: 'אחר' },
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['key'];

export type ExpenseDTO = {
  id: string;
  title: string;
  amountAgorot: number;
  spentOn: string;
  category: ExpenseCategory;
  receiptUrl: string | null;
  note: string | null;
};

export const expenseInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  amount: z.number().int().positive().max(1_000_000_000),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(['equipment', 'travel', 'marketing', 'staff', 'software', 'office', 'other']),
  receiptUrl: z.url().max(1000).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type FinancePayment = {
  id: string;
  leadId: string;
  clientName: string;
  eventDate: string | null;
  title: string;
  amountAgorot: number;
  dueDate: string | null;
  paidAt: string | null;
};

export type FinanceDTO = {
  from: string;
  to: string;
  collectedAgorot: number;
  expectedAgorot: number;
  expensesAgorot: number;
  /** Booked deals in the period: total value and what's still open on them. */
  bookedValueAgorot: number;
  openBalanceAgorot: number;
  months: { month: string; collected: number; expected: number; expenses: number }[];
  deposits: FinancePayment[];
  upcoming: FinancePayment[];
  balances: { leadId: string; clientName: string; eventDate: string | null; totalAgorot: number; paidAgorot: number }[];
};

// ---------- client documents (income side) ----------
export const DOCUMENT_KINDS = [
  { key: 'receipt', label: 'קבלה' },
  { key: 'quote', label: 'הצעת מחיר' },
  { key: 'payment_request', label: 'דרישת תשלום' },
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]['key'];

export const PAYMENT_METHODS = [
  { key: 'transfer', label: 'העברה בנקאית' },
  { key: 'bit', label: 'ביט / פייבוקס' },
  { key: 'credit', label: 'כרטיס אשראי' },
  { key: 'cash', label: 'מזומן' },
  { key: 'check', label: "צ'ק" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['key'];

export type ClientDocumentDTO = {
  id: string;
  kind: DocumentKind;
  number: number;
  issuedOn: string;
  leadId: string | null;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  description: string;
  amountAgorot: number;
  paymentMethod: PaymentMethod | null;
  /** The business, as printed on the document. */
  issuer: { businessName: string; taxId: string | null; address: string | null; phone: string | null; email: string | null };
  createdAt: string;
};

export const documentInputSchema = z.object({
  kind: z.enum(['receipt', 'quote', 'payment_request']),
  leadId: z.uuid().nullable().optional(),
  clientName: z.string().trim().min(1).max(160),
  clientPhone: z.string().trim().max(30).nullable().optional(),
  clientEmail: z.email().nullable().optional().or(z.literal('').transform(() => null)),
  description: z.string().trim().min(1).max(500),
  amount: z.number().int().positive().max(1_000_000_000),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(['transfer', 'bit', 'credit', 'cash', 'check']).nullable().optional(),
});

// ---------- subscription plans ----------
export const PLANS = [
  {
    key: 'basic',
    name: 'Basic',
    priceMonthly: 0,
    tagline: 'להתחיל להופיע מול זוגות',
    features: ['עמוד עסק בחיפוש', 'עד 20 תמונות בתיק העבודות', 'קבלת פניות והודעות', 'יומן זמינות'],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 149,
    tagline: 'לנהל את כל העסק במקום אחד',
    features: ['כל מה שב־Basic', 'תיק עבודות ללא הגבלה, כולל סרטונים', 'CRM וניהול לקוחות מלא', 'סטטיסטיקות ומדדי המרה', 'הכנסות, הוצאות ומסמכים', 'סנכרון ליומן Google ו־Apple'],
  },
  {
    key: 'premium',
    name: 'Premium',
    priceMonthly: 299,
    tagline: 'חשיפה מקסימלית ושירות אישי',
    features: ['כל מה שב־Pro', 'תג "מומלץ" והופעה בראש החיפוש', 'הופעה בהמלצות לזוגות בדף הבית', 'מנהל/ת לקוח אישי/ת', 'דוחות חודשיים'],
  },
] as const;
export type PlanKey = (typeof PLANS)[number]['key'];

/** A new vendor gets the plan they choose free for this many days. */
export const TRIAL_DAYS = 30;

/** The plan whose benefits apply now: the chosen plan while it is paid / in trial, else Basic. */
export function effectivePlan(plan: string, activeUntil: string | Date | null): PlanKey {
  if (plan === 'basic' || !activeUntil) return 'basic';
  return new Date(activeUntil).getTime() > Date.now() ? (plan as PlanKey) : 'basic';
}

// ---------- vendor settings ----------
export const NOTIFICATION_KINDS = [
  { key: 'newInquiry', label: 'פנייה חדשה מזוג' },
  { key: 'newMessage', label: 'הודעה חדשה' },
  { key: 'paymentDue', label: 'תשלום שמתקרב' },
  { key: 'eventReminder', label: 'תזכורת לאירוע' },
  { key: 'newReview', label: 'ביקורת חדשה' },
  { key: 'weeklySummary', label: 'סיכום שבועי' },
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]['key'];

/** When couples can book a short "match call" with the vendor (Israel time). */
export type MatchCallSettings = {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday. */
  days: number[];
  from: string;
  to: string;
  slotMinutes: 15 | 20 | 30;
};

export type VendorSettings = {
  notifications: Record<NotificationKind, boolean>;
  /** Add every new inquiry to the CRM automatically (else: one tap from the chat). */
  autoLeadFromInquiry: boolean;
  language: 'he' | 'en';
  matchCalls: MatchCallSettings;
};

export const DEFAULT_MATCH_CALLS: MatchCallSettings = { enabled: true, days: [0, 1, 2, 3, 4], from: '10:00', to: '18:00', slotMinutes: 20 };

export const DEFAULT_VENDOR_SETTINGS: VendorSettings = {
  notifications: { newInquiry: true, newMessage: true, paymentDue: true, eventReminder: true, newReview: true, weeklySummary: false },
  autoLeadFromInquiry: true,
  language: 'he',
  matchCalls: DEFAULT_MATCH_CALLS,
};

export const vendorSettingsSchema = z.object({
  notifications: z.record(z.string(), z.boolean()).optional(),
  autoLeadFromInquiry: z.boolean().optional(),
  language: z.enum(['he', 'en']).optional(),
  matchCalls: z
    .object({
      enabled: z.boolean(),
      days: z.array(z.number().int().min(0).max(6)).max(7),
      from: z.string().regex(/^\d{2}:\d{2}$/),
      to: z.string().regex(/^\d{2}:\d{2}$/),
      slotMinutes: z.union([z.literal(15), z.literal(20), z.literal(30)]),
    })
    .refine((m) => m.from < m.to, { message: 'שעת הסיום לפני שעת ההתחלה' })
    .optional(),
  taxId: z.string().trim().max(20).nullable().optional(),
  businessAddress: z.string().trim().max(200).nullable().optional(),
});

export type VendorAccountDTO = {
  plan: PlanKey;
  planSince: string | null;
  settings: VendorSettings;
  taxId: string | null;
  businessAddress: string | null;
  /** Private calendar feed (ICS) for Google / Apple subscription. */
  calendarFeedUrl: string;
};

// ---------- reviews (read side) ----------
export type ReviewDTO = {
  id: string;
  rating: number;
  body: string;
  /** "נועה ואיתי" — the couple's first names. */
  author: string;
  weddingDate: string | null;
  verified: boolean;
  vendorReply: string | null;
  createdAt: string;
};
