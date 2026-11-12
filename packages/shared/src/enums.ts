/**
 * Status enums shared by DB, API and UI. Keep these in sync with the pgEnums in
 * apps/server/src/db/schema.ts (they import from here, so they can't drift).
 */

export const USER_ROLES = ['couple', 'vendor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Vendor account moderation state (spec §17: admin approves vendors). */
export const VENDOR_STATUSES = ['pending', 'approved', 'suspended'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** Availability calendar statuses (spec §5, §11). */
export const AVAILABILITY_STATUSES = ['available', 'pending', 'booked', 'unavailable'] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

/** Lead pipeline (spec §10). */
export const LEAD_STATUSES = [
  'new',
  'contacted',
  'meeting',
  'proposal',
  'booked',
  'completed',
  'pending',
  'lost',
  'cancelled',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Per-category status on a wedding: still looking, or already closed (spec §3). */
export const WEDDING_CATEGORY_STATUSES = ['needed', 'closed'] as const;
export type WeddingCategoryStatus = (typeof WEDDING_CATEGORY_STATUSES)[number];

/** How a user relates to a wedding. Producers join later (spec §14.3). */
export const WEDDING_MEMBER_ROLES = ['partner', 'producer'] as const;
export type WeddingMemberRole = (typeof WEDDING_MEMBER_ROLES)[number];

export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
