/**
 * Vendor categories (spec §1). This list seeds the `categories` table; after that,
 * admins manage categories in the DB (spec §17), so treat this as the initial set,
 * not the source of truth at runtime.
 */
export const VENDOR_CATEGORIES = [
  { slug: 'venue', he: 'אולם / גן אירועים' },
  { slug: 'photography', he: 'צילום סטילס' },
  { slug: 'video', he: 'וידאו' },
  { slug: 'social', he: 'צילום סושיאל' },
  { slug: 'dj', he: 'DJ' },
  { slug: 'makeup', he: 'איפור' },
  { slug: 'hair', he: 'שיער' },
  { slug: 'dresses', he: 'שמלות כלה' },
  { slug: 'suits', he: 'חליפות חתן' },
  { slug: 'production', he: 'הפקת אירועים' },
  { slug: 'design', he: 'עיצוב אירועים' },
  { slug: 'flowers', he: 'פרחים' },
  { slug: 'attractions', he: 'אטרקציות' },
  { slug: 'magnets', he: 'מגנטים' },
  { slug: 'officiant', he: 'רב / עורך חופה' },
  { slug: 'transportation', he: 'הסעות' },
  { slug: 'invitations', he: 'הזמנות' },
  { slug: 'rings', he: 'טבעות' },
  { slug: 'getting_ready_hotels', he: 'מלונות התארגנות' },
  { slug: 'catering', he: 'קייטרינג' },
  { slug: 'alcohol', he: 'אלכוהול ובר' },
  { slug: 'rsvp', he: 'אישורי הגעה' },
  { slug: 'event_management', he: 'ניהול אירוע' },
  { slug: 'photo_booths', he: 'עמדות צילום' },
] as const;

export type VendorCategorySlug = (typeof VENDOR_CATEGORIES)[number]['slug'];

/** The category that unlocks producer tools (spec §14). */
export const PRODUCER_CATEGORY: VendorCategorySlug = 'production';
