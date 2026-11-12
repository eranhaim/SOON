/**
 * SOON domain schema v1 (trial scope).
 *
 * Design rules (spec §19–20):
 *  - One shared record per real-world thing; screens for couple / vendor / producer read
 *    the same rows through permissions, never copies.
 *  - A wedding is NOT a user: partners (and later a producer) are linked via wedding_member.
 *  - A lead can reference a registered wedding OR carry contact details for a couple who
 *    isn't in the app (spec §14.1).
 *  - Money is integer agorot.
 *  - Double-booking is blocked in the DB by an exclusion constraint on availability_entry
 *    (see the custom migration in /drizzle).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  AVAILABILITY_STATUSES,
  LEAD_STATUSES,
  MEDIA_KINDS,
  VENDOR_STATUSES,
  WEDDING_CATEGORY_STATUSES,
  WEDDING_MEMBER_ROLES,
} from '@soon/shared';

import { user } from './auth';

// ---------- enums ----------
export const vendorStatusEnum = pgEnum('vendor_status', VENDOR_STATUSES);
export const availabilityStatusEnum = pgEnum('availability_status', AVAILABILITY_STATUSES);
export const leadStatusEnum = pgEnum('lead_status', LEAD_STATUSES);
export const weddingCategoryStatusEnum = pgEnum('wedding_category_status', WEDDING_CATEGORY_STATUSES);
export const weddingMemberRoleEnum = pgEnum('wedding_member_role', WEDDING_MEMBER_ROLES);
export const mediaKindEnum = pgEnum('media_kind', MEDIA_KINDS);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------- categories (admin-managed, spec §17) ----------
export const category = pgTable('category', {
  slug: text('slug').primaryKey(),
  labelHe: text('label_he').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

// ---------- weddings ----------
export const wedding = pgTable('wedding', {
  id: uuid('id').primaryKey().defaultRandom(),
  partner1Name: text('partner1_name').notNull(),
  partner2Name: text('partner2_name').notNull(),
  weddingDate: date('wedding_date'),
  region: text('region'),
  venueName: text('venue_name'),
  budgetTotalAgorot: integer('budget_total_agorot'),
  coverImageUrl: text('cover_image_url'),
  ...timestamps,
});

export const weddingMember = pgTable(
  'wedding_member',
  {
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: weddingMemberRoleEnum('role').notNull().default('partner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.weddingId, t.userId] }), index('wedding_member_user_idx').on(t.userId)],
);

/** Which categories the couple already closed vs still needs (spec §3). */
export const weddingCategory = pgTable(
  'wedding_category',
  {
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    categorySlug: text('category_slug')
      .notNull()
      .references(() => category.slug),
    status: weddingCategoryStatusEnum('status').notNull(),
  },
  (t) => [primaryKey({ columns: [t.weddingId, t.categorySlug] })],
);

// ---------- vendors ----------
export const vendor = pgTable(
  'vendor',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    businessName: text('business_name').notNull(),
    slug: text('slug').notNull().unique(),
    categorySlug: text('category_slug')
      .notNull()
      .references(() => category.slug),
    /** No DB default on purpose: the app always sets it ('draft' on creation). */
    status: vendorStatusEnum('status').notNull(),
    /** Reason for rejection / suspension, shown to the vendor. */
    statusReason: text('status_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    about: text('about'),
    phone: text('phone'),
    email: text('email'),
    websiteUrl: text('website_url'),
    instagramUrl: text('instagram_url'),
    logoUrl: text('logo_url'),
    coverUrl: text('cover_url'),
    priceFromAgorot: integer('price_from_agorot'),
    priceToAgorot: integer('price_to_agorot'),
    cancellationPolicy: text('cancellation_policy'),
    isFeatured: boolean('is_featured').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('vendor_owner_idx').on(t.ownerUserId),
    index('vendor_category_status_idx').on(t.categorySlug, t.status),
    check(
      'vendor_price_range_ck',
      sql`${t.priceFromAgorot} IS NULL OR ${t.priceToAgorot} IS NULL OR ${t.priceFromAgorot} <= ${t.priceToAgorot}`,
    ),
  ],
);

export const vendorRegion = pgTable(
  'vendor_region',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    region: text('region').notNull(),
  },
  (t) => [primaryKey({ columns: [t.vendorId, t.region] }), index('vendor_region_region_idx').on(t.region)],
);

export const vendorMedia = pgTable(
  'vendor_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum('kind').notNull().default('image'),
    url: text('url').notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vendor_media_vendor_idx').on(t.vendorId, t.sortOrder)],
);

export const vendorPackage = pgTable(
  'vendor_package',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    priceAgorot: integer('price_agorot'),
    includes: text('includes').array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('vendor_package_vendor_idx').on(t.vendorId)],
);

export const vendorFaq = pgTable(
  'vendor_faq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('vendor_faq_vendor_idx').on(t.vendorId)],
);

// ---------- leads / CRM (spec §10) ----------
export const lead = pgTable(
  'lead',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    /** Set when the couple is registered in SOON. */
    weddingId: uuid('wedding_id').references(() => wedding.id, { onDelete: 'set null' }),
    /** Contact details for couples who are not (yet) in the app. */
    clientName: text('client_name'),
    clientPhone: text('client_phone'),
    clientEmail: text('client_email'),
    eventDate: date('event_date'),
    location: text('location'),
    status: leadStatusEnum('status').notNull().default('new'),
    quotedPriceAgorot: integer('quoted_price_agorot'),
    notes: text('notes'),
    nextAction: text('next_action'),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('lead_vendor_status_idx').on(t.vendorId, t.status),
    index('lead_vendor_event_date_idx').on(t.vendorId, t.eventDate),
    unique('lead_vendor_wedding_uq').on(t.vendorId, t.weddingId),
    check('lead_has_client_ck', sql`${t.weddingId} IS NOT NULL OR ${t.clientName} IS NOT NULL`),
  ],
);

// ---------- availability (spec §5, §11) ----------
export const availabilityEntry = pgTable(
  'availability_entry',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    status: availabilityStatusEnum('status').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    title: text('title'),
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('availability_vendor_range_idx').on(t.vendorId, t.startsAt, t.endsAt),
    check('availability_range_ck', sql`${t.startsAt} < ${t.endsAt}`),
    // + EXCLUDE constraint (no overlapping 'booked' entries per vendor) in custom migration.
  ],
);

// ---------- messaging (spec §8) ----------
export const conversation = pgTable(
  'conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('conversation_vendor_wedding_uq').on(t.vendorId, t.weddingId),
    index('conversation_wedding_idx').on(t.weddingId, t.lastMessageAt),
    index('conversation_vendor_idx').on(t.vendorId, t.lastMessageAt),
  ],
);

export const message = pgTable(
  'message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body'),
    attachmentUrl: text('attachment_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    index('message_conversation_idx').on(t.conversationId, t.createdAt),
    check('message_not_empty_ck', sql`${t.body} IS NOT NULL OR ${t.attachmentUrl} IS NOT NULL`),
  ],
);

// ---------- saved (spec §6) ----------
/** Saved belongs to the wedding, so both partners share one list. Boards come later. */
export const savedVendor = pgTable(
  'saved_vendor',
  {
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    savedByUserId: text('saved_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.weddingId, t.vendorId] })],
);

// ---------- admin action log (spec §17) ----------
export const adminAction = pgTable(
  'admin_action',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminUserId: text('admin_user_id').references(() => user.id, { onDelete: 'set null' }),
    /** One of ADMIN_ACTIONS, e.g. 'vendor.approve'. Text so new actions need no migration. */
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_action_target_idx').on(t.targetType, t.targetId, t.createdAt)],
);
