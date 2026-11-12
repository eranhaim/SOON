import { z } from 'zod';

import { VENDOR_CATEGORIES } from './categories';
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
    category: categorySlug,
    phone,
    regions: z.array(region).min(1),
    about: z.string().trim().max(2000).optional(),
    priceFrom: agorot.optional(),
    priceTo: agorot.optional(),
  })
  .refine(priceRangeOk, priceRangeMsg);
export type VendorOnboarding = z.infer<typeof vendorOnboardingSchema>;

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
});

// ---------- admin ----------
export const adminRejectSchema = z.object({ reason: z.string().trim().min(5, 'נא לפרט סיבה').max(1000) });
export const adminSuspendSchema = z.object({ reason: z.string().trim().min(5, 'נא לפרט סיבה').max(1000) });

// ---------- uploads ----------
export const UPLOAD_PURPOSES = ['vendor-cover', 'vendor-logo', 'vendor-gallery'] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];
export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const uploadRequestSchema = z.object({
  purpose: z.enum(UPLOAD_PURPOSES),
  contentType: z.enum(IMAGE_CONTENT_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type UploadTicket = { uploadUrl: string; publicUrl: string; headers: Record<string, string> };

/** Vendor search query (spec §5). */
export const vendorSearchSchema = z.object({
  category: categorySlug.optional(),
  region: region.optional(),
  date: isoDate.optional(),
  priceMin: agorot.optional(),
  priceMax: agorot.optional(),
  onlyAvailable: z.coerce.boolean().default(false),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['relevance', 'popular', 'rating', 'price_asc', 'price_desc']).default('relevance'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type VendorSearch = z.infer<typeof vendorSearchSchema>;
