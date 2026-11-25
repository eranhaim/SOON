import { z } from 'zod';

import { VENDOR_CATEGORIES } from './categories';
import { AVAILABILITY_STATUSES, CALENDAR_ENTRY_KINDS, GUEST_SIDES, LEAD_STATUSES, RSVP_STATUSES, WEDDING_EVENT_KINDS } from './enums';
import { BUDGET_CATEGORY_KEYS } from './planning';
import { REGION_SLUGS } from './regions';

/**
 * Money is always stored and sent as integer agorot (1 ₪ = 100 agorot) to avoid
 * floating-point errors. Convert to shekels only for display.
 */
export const agorot = z.number().int().nonnegative();

const categorySlug = z.enum(VENDOR_CATEGORIES.map((c) => c.slug) as [string, ...string[]]);
const region = z.enum(REGION_SLUGS);
const isoDate = z.iso.date(); // YYYY-MM-DD
const phone = z.string().trim().min(9).max(20);

/** Couple onboarding (spec §3). Everything but names is optional — "complete later". */
export const coupleOnboardingSchema = z.object({
  partner1Name: z.string().trim().min(1).max(80),
  partner2Name: z.string().trim().min(1).max(80),
  phone: phone.optional(),
  weddingDate: isoDate.optional(),
  region: region.optional(),
  venueName: z.string().trim().max(120).optional(),
  budgetTotal: agorot.optional(),
  closedCategories: z.array(categorySlug).default([]),
  neededCategories: z.array(categorySlug).default([]),
});
export type CoupleOnboarding = z.infer<typeof coupleOnboardingSchema>;

const priceRangeOk = (v: { priceFrom?: number | null; priceTo?: number | null }) =>
  v.priceFrom == null || v.priceTo == null || v.priceFrom <= v.priceTo;
const priceRangeMsg = { message: 'מחיר ההתחלה גבוה ממחיר הסיום', path: ['priceTo'] };

/** Vendor onboarding (3 steps) — the minimum to create a storefront. */
export const vendorOnboardingSchema = z
  .object({
    businessName: z.string().trim().min(2).max(100),
    /** First name of the person behind the business. */
    firstName: z.string().trim().min(2, 'נא לכתוב שם פרטי').max(40),
    category: categorySlug,
    phone,
    regions: z.array(region).min(1),
    /** Plan chosen at sign-up; it is free for the first month. */
    plan: z.enum(['basic', 'pro', 'premium']).default('basic'),
    about: z.string().trim().max(2000).optional(),
    priceFrom: agorot.optional(),
    priceTo: agorot.optional(),
  })
  .refine(priceRangeOk, priceRangeMsg);
export type VendorOnboarding = z.infer<typeof vendorOnboardingSchema>;

/** "Help me write" the About text (works before the business exists, in sign-up). */
export const aboutDraftSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  category: categorySlug,
  regions: z.array(region).max(20).default([]),
  notes: z.string().trim().max(1500).default(''),
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }), z.literal('')])
  .nullable()
  .optional()
  .transform((v) => (v === '' ? null : v));

/** Partial update of the vendor's own storefront. `null` clears a field. */
export const vendorProfileUpdateSchema = z
  .object({
    businessName: z.string().trim().min(2).max(100).optional(),
    contactFirstName: optionalText(40),
    category: categorySlug.optional(),
    about: optionalText(4000),
    phone: phone.nullable().optional(),
    email: z.email().nullable().optional(),
    websiteUrl: optionalUrl,
    instagramUrl: optionalUrl,
    priceFrom: agorot.nullable().optional(),
    priceTo: agorot.nullable().optional(),
    cancellationPolicy: optionalText(4000),
    regions: z.array(region).min(1).optional(),
    /** Must be a URL previously issued by POST /api/uploads for this vendor. */
    coverUrl: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
  })
  .refine(priceRangeOk, priceRangeMsg);
export type VendorProfileUpdate = z.infer<typeof vendorProfileUpdateSchema>;

export const vendorPackageInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(2000),
  priceAgorot: agorot.nullable().optional(),
  includes: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
});
export type VendorPackageInput = z.infer<typeof vendorPackageInputSchema>;

export const vendorFaqInputSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(2000),
});
export type VendorFaqInput = z.infer<typeof vendorFaqInputSchema>;

/** Reorder any vendor list (media / packages / faqs): ids in their new order. */
export const reorderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(200) });

export const addMediaSchema = z.object({
  url: z.string().min(1),
  caption: optionalText(300),
  kind: z.enum(['image', 'video']).optional(),
});

// ---------- admin ----------
export const adminRejectSchema = z.object({ reason: z.string().trim().min(5, 'נא לפרט סיבה').max(1000) });
export const adminSuspendSchema = z.object({ reason: z.string().trim().min(5, 'נא לפרט סיבה').max(1000) });

// ---------- uploads ----------
export const UPLOAD_PURPOSES = [
  'vendor-cover',
  'vendor-logo',
  'vendor-gallery',
  'vendor-video',
  'vendor-receipt',
  /** Couple uploads (stored under the wedding). */
  'wedding-cover',
  'wedding-image',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_CONTENT_TYPES = ['video/mp4', 'video/quicktime'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

/** Which file types each upload purpose accepts, and how big. */
export const UPLOAD_RULES: Record<UploadPurpose, { types: readonly string[]; maxBytes: number }> = {
  'vendor-cover': { types: IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES },
  'vendor-logo': { types: IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES },
  'vendor-gallery': { types: IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES },
  'vendor-video': { types: VIDEO_CONTENT_TYPES, maxBytes: MAX_VIDEO_BYTES },
  'vendor-receipt': { types: [...IMAGE_CONTENT_TYPES, 'application/pdf'], maxBytes: MAX_IMAGE_BYTES },
  'wedding-cover': { types: IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES },
  'wedding-image': { types: IMAGE_CONTENT_TYPES, maxBytes: MAX_IMAGE_BYTES },
};

export const uploadRequestSchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES),
    contentType: z.string().max(100),
    size: z.number().int().positive(),
  })
  .refine((v) => UPLOAD_RULES[v.purpose].types.includes(v.contentType), { message: 'סוג הקובץ לא נתמך', path: ['contentType'] })
  .refine((v) => v.size <= UPLOAD_RULES[v.purpose].maxBytes, { message: 'הקובץ גדול מדי', path: ['size'] });
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type UploadTicket = { uploadUrl: string; publicUrl: string; headers: Record<string, string> };

const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Vendor search query (spec §5). */
export const vendorSearchSchema = z.object({
  category: categorySlug.optional(),
  region: region.optional(),
  date: isoDate.optional(),
  priceMin: z.coerce.number().int().nonnegative().optional(),
  priceMax: z.coerce.number().int().nonnegative().optional(),
  /** Query-string boolean. (z.coerce.boolean would turn the string "false" into true.) */
  onlyAvailable: queryBool,
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['relevance', 'popular', 'rating', 'price_asc', 'price_desc']).default('relevance'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type VendorSearch = z.infer<typeof vendorSearchSchema>;

/** Partial wedding update from the couple's profile. `null` clears a field. */
export const weddingUpdateSchema = z.object({
  partner1Name: z.string().trim().min(1).max(80).optional(),
  partner2Name: z.string().trim().min(1).max(80).optional(),
  weddingDate: isoDate.nullable().optional(),
  region: region.nullable().optional(),
  venueName: z.string().trim().max(120).nullable().optional(),
  budgetTotal: agorot.nullable().optional(),
  /** Home screen background photo (https URL). */
  coverImageUrl: z.url().max(1000).nullable().optional(),
  /** The signed-in partner's own phone (vendors see it in chats for WhatsApp). */
  phone: phone.nullable().optional(),
  closedCategories: z.array(categorySlug).optional(),
  neededCategories: z.array(categorySlug).optional(),
});
export type WeddingUpdate = z.infer<typeof weddingUpdateSchema>;

export const savedNoteSchema = z.object({ note: z.string().trim().max(1000).nullable() });

// ---------- couple planning (spec §7) ----------
const isoDateTime = z.iso.datetime({ offset: true });
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v));

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: nullableText(2000),
  dueDate: isoDate.nullable().optional(),
  remindAt: isoDateTime.nullable().optional(),
});
export const taskUpdateSchema = taskInputSchema.partial().extend({ done: z.boolean().optional() });
export type TaskInput = z.infer<typeof taskInputSchema>;

export const budgetItemInputSchema = z.object({
  category: z.enum(BUDGET_CATEGORY_KEYS),
  title: z.string().trim().min(1).max(120),
  vendorId: z.uuid().nullable().optional(),
  vendorName: nullableText(120),
  planned: agorot.nullable().optional(),
  actual: agorot.nullable().optional(),
  notes: nullableText(2000),
});
export const budgetItemUpdateSchema = budgetItemInputSchema.partial();
export type BudgetItemInput = z.infer<typeof budgetItemInputSchema>;

export const weddingPaymentInputSchema = z.object({
  budgetItemId: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  amount: agorot,
  dueDate: isoDate.nullable().optional(),
  paid: z.boolean().optional(),
});
export const weddingPaymentUpdateSchema = weddingPaymentInputSchema.partial();

export const guestInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  side: z.enum(GUEST_SIDES).default('shared'),
  phone: nullableText(20),
  rsvp: z.enum(RSVP_STATUSES).default('invited'),
  partySize: z.number().int().min(1).max(50).default(1),
  tableLabel: nullableText(40),
  notes: nullableText(1000),
});
export const guestUpdateSchema = guestInputSchema.partial();
/** Quick add: one guest per line. */
export const guestBulkSchema = z.object({
  names: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
  side: z.enum(GUEST_SIDES).default('shared'),
});
export type GuestInput = z.infer<typeof guestInputSchema>;

export const weddingEventInputSchema = z
  .object({
    kind: z.enum(WEDDING_EVENT_KINDS).default('meeting'),
    title: z.string().trim().min(1).max(160),
    startsAt: isoDateTime,
    endsAt: isoDateTime.nullable().optional(),
    location: nullableText(200),
    vendorId: z.uuid().nullable().optional(),
    notes: nullableText(2000),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: 'שעת הסיום לפני שעת ההתחלה', path: ['endsAt'] });
export const weddingEventUpdateSchema = z.object({
  kind: z.enum(WEDDING_EVENT_KINDS).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  startsAt: isoDateTime.optional(),
  endsAt: isoDateTime.nullable().optional(),
  location: nullableText(200),
  vendorId: z.uuid().nullable().optional(),
  notes: nullableText(2000),
});

// ---------- marketplace loop: inquiries, chat, CRM, calendar (spec §5, §8, §10, §11) ----------
export const INQUIRY_KINDS = ['message', 'quote', 'availability'] as const;
export const inquirySchema = z.object({
  kind: z.enum(INQUIRY_KINDS).default('message'),
  message: z.string().trim().min(1).max(2000),
  eventDate: isoDate.nullable().optional(),
  guestCount: z.number().int().min(1).max(5000).nullable().optional(),
  packageId: z.uuid().nullable().optional(),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const messageSendSchema = z.object({ body: z.string().trim().min(1).max(4000) });

const leadFields = {
  clientName: z.string().trim().min(1).max(120),
  clientPhone: nullableText(20),
  clientEmail: z.email().nullable().optional().or(z.literal('').transform(() => null)),
  eventDate: isoDate.nullable().optional(),
  location: nullableText(200),
  guestCount: z.number().int().min(1).max(5000).nullable().optional(),
  quotedPrice: agorot.nullable().optional(),
  notes: nullableText(4000),
  nextAction: nullableText(200),
  nextActionAt: isoDateTime.nullable().optional(),
};
export const leadCreateSchema = z.object(leadFields);
export const leadUpdateSchema = z.object({ ...leadFields, status: z.enum(LEAD_STATUSES) }).partial();
export type LeadCreate = z.infer<typeof leadCreateSchema>;

export const leadPaymentInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  amount: agorot,
  dueDate: isoDate.nullable().optional(),
  paid: z.boolean().optional(),
});
export const leadPaymentUpdateSchema = leadPaymentInputSchema.partial();

export const calendarEntryInputSchema = z
  .object({
    status: z.enum(AVAILABILITY_STATUSES),
    kind: z.enum(CALENDAR_ENTRY_KINDS).default('event'),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    title: nullableText(160),
    location: nullableText(200),
    note: nullableText(2000),
    leadId: z.uuid().nullable().optional(),
    /** A couple registered in SOON (picked by search); links/creates their lead too. */
    weddingId: z.uuid().nullable().optional(),
    deposit: agorot.nullable().optional(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: 'שעת הסיום לפני שעת ההתחלה', path: ['endsAt'] });
export const calendarEntryUpdateSchema = z.object({
  status: z.enum(AVAILABILITY_STATUSES).optional(),
  kind: z.enum(CALENDAR_ENTRY_KINDS).optional(),
  startsAt: isoDateTime.optional(),
  endsAt: isoDateTime.optional(),
  title: nullableText(160),
  location: nullableText(200),
  note: nullableText(2000),
  leadId: z.uuid().nullable().optional(),
  weddingId: z.uuid().nullable().optional(),
  deposit: agorot.nullable().optional(),
});

/** Vendor adds a registered couple as a client (lead) from the couple search. */
export const leadFromWeddingSchema = z.object({ weddingId: z.uuid() });

// ---------- match calls ----------
export const callBookingSchema = z.object({ startsAt: isoDateTime, note: nullableText(500) });
export const callbackRequestSchema = z.object({ phone: nullableText(20), note: nullableText(500) });

// ---------- reviews (couples) ----------
const stars = z.number().int().min(1).max(5);
export const reviewInputSchema = z.object({
  rating: stars,
  ratingProfessionalism: stars.nullable().optional(),
  ratingService: stars.nullable().optional(),
  ratingAvailability: stars.nullable().optional(),
  ratingValue: stars.nullable().optional(),
  body: z.string().trim().min(10, 'כתבו לפחות כמה מילים').max(3000),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;
export const reviewReplySchema = z.object({ reply: z.string().trim().max(2000).nullable() });

// ---------- couples community ----------
export const communityProfileSchema = z.object({
  optIn: z.boolean(),
  bio: nullableText(200),
});
export const coupleMessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

// ---------- inspiration boards ----------
export const boardCreateSchema = z.object({ title: z.string().trim().min(1).max(60) });
export const boardItemCreateSchema = z.object({
  imageUrl: z.url().max(1000),
  vendorId: z.uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
