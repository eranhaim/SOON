/**
 * Status enums shared by DB, API and UI. Keep these in sync with the pgEnums in
 * apps/server/src/db/schema.ts (they import from here, so they can't drift).
 */

export const USER_ROLES = ['couple', 'vendor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Vendor moderation lifecycle (spec §17: admin approves vendors).
 *   draft ──submit──▶ pending ──approve──▶ approved ──suspend──▶ suspended
 *                       │                     ▲                     │
 *                     reject                  └──────reinstate──────┘
 *                       ▼
 *                    rejected ──fix & resubmit──▶ pending
 * Only `approved` vendors are visible to couples.
 */
export const VENDOR_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'suspended'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  draft: 'טיוטה',
  pending: 'ממתין לאישור',
  approved: 'מאושר',
  rejected: 'נדחה',
  suspended: 'מושעה',
};

/** Admin moderation actions, recorded in admin_action (spec §17: admin action log). */
export const ADMIN_ACTIONS = ['vendor.approve', 'vendor.reject', 'vendor.suspend', 'vendor.reinstate'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

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
