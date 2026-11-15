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
export const ADMIN_ACTIONS = [
  'vendor.approve',
  'vendor.reject',
  'vendor.suspend',
  'vendor.reinstate',
  'vendor.feature',
  'vendor.unfeature',
  'review.hide',
  'review.restore',
  'user.ban',
  'user.unban',
  'category.update',
] as const;
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

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'פנוי',
  pending: 'בהמתנה',
  booked: 'תפוס',
  unavailable: 'אישי / לא זמין',
};

/** What a calendar entry is (spec §11: wedding, meeting, personal event…). */
export const CALENDAR_ENTRY_KINDS = ['event', 'meeting', 'personal', 'other'] as const;
export type CalendarEntryKind = (typeof CALENDAR_ENTRY_KINDS)[number];
export const CALENDAR_ENTRY_KIND_LABELS: Record<CalendarEntryKind, string> = {
  event: 'אירוע',
  meeting: 'פגישה',
  personal: 'אישי',
  other: 'אחר',
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'פנייה חדשה',
  contacted: 'נוצר קשר',
  meeting: 'פגישה',
  proposal: 'הצעת מחיר',
  booked: 'נסגר',
  completed: 'הושלם',
  pending: 'בהמתנה',
  lost: 'לא רלוונטי',
  cancelled: 'בוטל',
};
/** The main pipeline, in order (spec §10). The rest are side exits. */
export const LEAD_PIPELINE: LeadStatus[] = ['new', 'contacted', 'meeting', 'proposal', 'booked', 'completed'];
/** Statuses that count as an active client relationship. */
export const ACTIVE_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'meeting', 'proposal', 'pending', 'booked'];
/** A booked or completed lead proves a working relationship (verified reviews, spec §17). */
export const CLOSED_LEAD_STATUSES: LeadStatus[] = ['booked', 'completed'];

/** Where a lead came from: a couple in the app, or typed in by the vendor (spec §14.1). */
export const LEAD_SOURCES = ['app', 'manual'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const REVIEW_STATUSES = ['published', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Optional sub-ratings (spec §17). */
export const REVIEW_ASPECTS = ['professionalism', 'service', 'availability', 'value'] as const;
export type ReviewAspect = (typeof REVIEW_ASPECTS)[number];
export const REVIEW_ASPECT_LABELS: Record<ReviewAspect, string> = {
  professionalism: 'מקצועיות',
  service: 'שירות',
  availability: 'זמינות',
  value: 'תמורה למחיר',
};

// ---------- planning (spec §7) ----------
export const GUEST_SIDES = ['bride', 'groom', 'shared'] as const;
export type GuestSide = (typeof GUEST_SIDES)[number];
export const GUEST_SIDE_LABELS: Record<GuestSide, string> = { bride: 'צד הכלה', groom: 'צד החתן', shared: 'משותף' };

export const RSVP_STATUSES = ['invited', 'confirmed', 'declined', 'waiting'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  invited: 'הוזמן',
  confirmed: 'אישר הגעה',
  declined: 'לא מגיע',
  waiting: 'ממתין לתשובה',
};

export const WEDDING_EVENT_KINDS = ['meeting', 'tasting', 'fitting', 'trial', 'payment', 'deadline', 'other'] as const;
export type WeddingEventKind = (typeof WEDDING_EVENT_KINDS)[number];
export const WEDDING_EVENT_KIND_LABELS: Record<WeddingEventKind, string> = {
  meeting: 'פגישה עם ספק',
  tasting: 'טעימות',
  fitting: 'מדידה',
  trial: 'ניסיון איפור ושיער',
  payment: 'תשלום',
  deadline: 'דדליין',
  other: 'אחר',
};
