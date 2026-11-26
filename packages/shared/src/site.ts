/** Interactive invitation (wedding site), RSVP, blessings, gifts, invitation templates, admin and billing. */
import { z } from 'zod';

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).nullable().optional();
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

// ---------- invitation templates (admin) ----------
export type InvitationTemplateDTO = {
  id: string;
  name: string;
  backgroundUrl: string | null;
  paperColor: string;
  textColor: string;
  accentColor: string;
  font: 'serif' | 'sans';
  active: boolean;
  sortOrder: number;
};

export const templateInputSchema = z.object({
  name: text(60).min(2),
  backgroundUrl: z.url().max(1000).nullable().optional(),
  paperColor: hexColor,
  textColor: hexColor,
  accentColor: hexColor,
  font: z.enum(['serif', 'sans']),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

// ---------- the wedding site ----------
export type WeddingSiteDetails = {
  schedule: { time: string; label: string }[];
  venueAddress: string | null;
  dressCode: string | null;
  parking: string | null;
  shuttles: string | null;
  kids: string | null;
  food: string | null;
  accessibility: string | null;
};

export const EMPTY_SITE_DETAILS: WeddingSiteDetails = {
  schedule: [
    { time: '19:00', label: 'קבלת פנים' },
    { time: '20:30', label: 'חופה' },
  ],
  venueAddress: null,
  dressCode: null,
  parking: null,
  shuttles: null,
  kids: null,
  food: null,
  accessibility: null,
};

export type WeddingSiteDTO = {
  slug: string;
  published: boolean;
  templateId: string | null;
  coverUrl: string | null;
  story: string | null;
  details: WeddingSiteDetails;
  rsvpEnabled: boolean;
  giftsEnabled: boolean;
};

export const siteUpdateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{2,39}$/, 'כתובת באנגלית: אותיות, ספרות ומקף (3–40 תווים)')
    .optional(),
  published: z.boolean().optional(),
  templateId: z.uuid().nullable().optional(),
  coverUrl: z.url().max(1000).nullable().optional(),
  story: optText(3000),
  details: z
    .object({
      schedule: z.array(z.object({ time: text(10), label: text(60).min(1) })).max(12),
      venueAddress: optText(200),
      dressCode: optText(200),
      parking: optText(300),
      shuttles: optText(300),
      kids: optText(200),
      food: optText(300),
      accessibility: optText(300),
    })
    .partial()
    .optional(),
  rsvpEnabled: z.boolean().optional(),
  giftsEnabled: z.boolean().optional(),
});

/** What guests see on /i/<slug>. */
export type PublicSiteDTO = {
  slug: string;
  partner1Name: string;
  partner2Name: string;
  weddingDate: string | null;
  venueName: string | null;
  coverUrl: string | null;
  story: string | null;
  details: WeddingSiteDetails;
  rsvpEnabled: boolean;
  giftsEnabled: boolean;
  template: InvitationTemplateDTO | null;
  invitation: { opening: string; body: string; closing: string } | null;
  /** SOON's service fee on gifts, in basis points (500 = 5%). */
  giftFeeBps: number;
  /** Only the couple sees an unpublished site (preview). */
  published: boolean;
};

export const rsvpSchema = z.object({
  name: text(80).min(2, 'נא לכתוב שם'),
  phone: optText(20),
  attending: z.enum(['yes', 'no', 'maybe']),
  partySize: z.number().int().min(1).max(20).default(1),
  note: optText(300),
});

export const blessingSchema = z.object({
  name: text(80).min(2, 'נא לכתוב שם'),
  body: text(1000).min(2, 'נא לכתוב ברכה'),
});

/** Gift amounts in agorot: 18 ₪ to 10,000 ₪. */
export const giftCheckoutSchema = z.object({
  giverName: text(80).min(2, 'נא לכתוב שם'),
  giverPhone: optText(20),
  blessing: optText(1000),
  amount: z.number().int().min(18_00, 'הסכום המינימלי הוא 18 ₪').max(10_000_00, 'הסכום המקסימלי הוא 10,000 ₪'),
});

/** Fee on top of the gift, rounded to whole agorot. */
export const giftFee = (amountAgorot: number, feeBps: number) => Math.round((amountAgorot * feeBps) / 10_000);

export type GiftDTO = {
  id: string;
  giverName: string;
  blessing: string | null;
  amountAgorot: number;
  status: 'pending' | 'paid' | 'failed';
  paidAt: string | null;
  createdAt: string;
};
export type BlessingDTO = { id: string; name: string; body: string; createdAt: string };
export type SiteActivityDTO = {
  gifts: GiftDTO[];
  blessings: BlessingDTO[];
  /** Paid gifts total (what the couple receives). */
  giftsTotalAgorot: number;
  rsvp: { yes: number; no: number; maybe: number; people: number };
};

// ---------- admin ----------
export type AdminUserDTO = {
  id: string;
  name: string;
  email: string;
  role: 'couple' | 'vendor' | 'admin' | null;
  image: string | null;
  createdAt: string;
  /** "נועה ואיתי" for couples, the business for vendors. */
  context: string | null;
  bannedAt: string | null;
};

export const adminCreateUserSchema = z.object({
  name: text(80).min(2),
  email: z.email(),
  password: z.string().min(8, 'לפחות 8 תווים').max(128),
  role: z.enum(['couple', 'vendor', 'admin']),
  /** Optional avatar (public image URL). */
  image: z.url().max(1000).nullable().optional(),
});
export const adminRoleSchema = z.object({ role: z.enum(['couple', 'vendor', 'admin']) });
export const adminPasswordSchema = z.object({ password: z.string().min(8, 'לפחות 8 תווים').max(128) });

export type AdminCoupleDTO = {
  weddingId: string;
  names: string;
  weddingDate: string | null;
  region: string | null;
  members: { name: string; email: string }[];
  tasks: { done: number; total: number };
  vendorsBooked: number;
  budgetTotalAgorot: number | null;
  budgetCommittedAgorot: number;
  guests: number;
  sitePublished: boolean;
  giftsPaidAgorot: number;
  createdAt: string;
};

export type AppSettingsDTO = { giftFeeBps: number };
export const appSettingsSchema = z.object({ giftFeeBps: z.number().int().min(0).max(2000) });
export const DEFAULT_GIFT_FEE_BPS = 500;

// ---------- vendor billing ----------
export type VendorBillingDTO = {
  plan: 'basic' | 'pro' | 'premium';
  planActiveUntil: string | null;
  card: { last4: string | null; brand: string | null; expiry: string | null } | null;
  charges: { id: string; plan: string; amountAgorot: number; status: 'pending' | 'paid' | 'failed'; createdAt: string; error: string | null }[];
  /** false = test mode (no real money moves). */
  paymentsLive: boolean;
  /** Cards can be saved for automatic monthly charges; otherwise each month is paid on a payment page. */
  canSaveCard: boolean;
};
