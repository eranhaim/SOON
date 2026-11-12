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

/** Vendor onboarding — the minimum to create a (pending) storefront. */
export const vendorOnboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  category: categorySlug,
  phone,
  regions: z.array(region).min(1),
  about: z.string().trim().max(2000).optional(),
  priceFrom: agorot.optional(),
  priceTo: agorot.optional(),
});
export type VendorOnboarding = z.infer<typeof vendorOnboardingSchema>;

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
