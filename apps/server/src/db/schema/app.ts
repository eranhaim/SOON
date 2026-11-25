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
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  type InvitationDTO,
  type VendorSettings,
  type WeddingSiteDetails,
  AVAILABILITY_STATUSES,
  CALENDAR_ENTRY_KINDS,
  GUEST_SIDES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  MEDIA_KINDS,
  REVIEW_STATUSES,
  RSVP_STATUSES,
  VENDOR_STATUSES,
  WEDDING_CATEGORY_STATUSES,
  WEDDING_EVENT_KINDS,
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
export const calendarEntryKindEnum = pgEnum('calendar_entry_kind', CALENDAR_ENTRY_KINDS);
export const leadSourceEnum = pgEnum('lead_source', LEAD_SOURCES);
export const reviewStatusEnum = pgEnum('review_status', REVIEW_STATUSES);
export const guestSideEnum = pgEnum('guest_side', GUEST_SIDES);
export const rsvpStatusEnum = pgEnum('rsvp_status', RSVP_STATUSES);
export const weddingEventKindEnum = pgEnum('wedding_event_kind', WEDDING_EVENT_KINDS);

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
  /** Last saved invitation text (AI or template), shown and shared from the planning tools. */
  invitation: jsonb('invitation').$type<InvitationDTO>(),
  /** Opt-in: other couples can find this couple in the community and message them. */
  communityOptIn: boolean('community_opt_in').notNull().default(false),
  /** Short line other couples see ("מתחתנים בקיץ, מחפשים המלצות על DJ"). */
  communityBio: text('community_bio'),
  ...timestamps,
});

/** Link one partner sends the other to join the same wedding (spec §3: two partners, one wedding). */
export const weddingInvite = pgTable(
  'wedding_invite',
  {
    token: text('token').primaryKey(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByUserId: text('used_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('wedding_invite_wedding_idx').on(t.weddingId)],
);

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
    /** First name of the person behind the business (greeting, CRM, admin). */
    contactFirstName: text('contact_first_name'),
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
    /** Subscription plan (PLANS in @soon/shared). Billing is not connected yet. */
    plan: text('plan').notNull().default('basic'),
    planSince: timestamp('plan_since', { withTimezone: true }),
    /**
     * The chosen plan is active until this moment (free first month, then paid periods).
     * After it passes the vendor gets Basic benefits until a payment renews it.
     */
    planActiveUntil: timestamp('plan_active_until', { withTimezone: true }),
    /** Partial VendorSettings; missing keys fall back to DEFAULT_VENDOR_SETTINGS. */
    settings: jsonb('settings').$type<Partial<VendorSettings>>().notNull().default({}),
    /** Printed on client documents (עוסק מורשה / ח.פ, address). */
    taxId: text('tax_id'),
    businessAddress: text('business_address'),
    /** Secret token for the private ICS feed (Google / Apple calendar subscription). */
    calendarToken: text('calendar_token').unique(),
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
    /** FAQ_TEMPLATES key when the answer was picked from ready choices; null for free text. */
    templateKey: text('template_key'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('vendor_faq_vendor_idx').on(t.vendorId), unique('vendor_faq_template_uq').on(t.vendorId, t.templateKey)],
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
    source: leadSourceEnum('source').notNull().default('app'),
    guestCount: integer('guest_count'),
    /** The package the couple asked about, if any. */
    packageId: uuid('package_id').references(() => vendorPackage.id, { onDelete: 'set null' }),
    quotedPriceAgorot: integer('quoted_price_agorot'),
    notes: text('notes'),
    nextAction: text('next_action'),
    nextActionAt: timestamp('next_action_at', { withTimezone: true }),
    /** First time the lead reached "booked" (weekly deal statistics). */
    bookedAt: timestamp('booked_at', { withTimezone: true }),
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
    kind: calendarEntryKindEnum('kind').notNull().default('event'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    title: text('title'),
    location: text('location'),
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    /** The couple's wedding this entry belongs to; the couple then sees it in their calendar. */
    weddingId: uuid('wedding_id').references(() => wedding.id, { onDelete: 'set null' }),
    /** Deposit agreed for this booking, if any. */
    depositAgorot: integer('deposit_agorot'),
    note: text('note'),
    ...timestamps,
  },
  (t) => [
    index('availability_vendor_range_idx').on(t.vendorId, t.startsAt, t.endsAt),
    index('availability_wedding_idx').on(t.weddingId, t.startsAt),
    check('availability_deposit_ck', sql`${t.depositAgorot} IS NULL OR ${t.depositAgorot} >= 0`),
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
    /** Read receipts per side: everything the other side sent before this is "read". */
    vendorReadAt: timestamp('vendor_read_at', { withTimezone: true }),
    weddingReadAt: timestamp('wedding_read_at', { withTimezone: true }),
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

// ---------- inspiration boards (spec §6) ----------
/** A couple's mood board ("my dress", "flowers"…). Belongs to the wedding, like saved vendors. */
export const board = pgTable(
  'board',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** Shown when the board has no items yet. */
    coverUrl: text('cover_url'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('board_wedding_idx').on(t.weddingId)],
);

/** One picture on a board, optionally linked to the vendor whose work it is. */
export const boardItem = pgTable(
  'board_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    boardId: uuid('board_id')
      .notNull()
      .references(() => board.id, { onDelete: 'cascade' }),
    imageUrl: text('image_url').notNull(),
    vendorId: uuid('vendor_id').references(() => vendor.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('board_item_board_idx').on(t.boardId)],
);

// ---------- wedding playlist ----------
export const weddingSong = pgTable(
  'wedding_song',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    /** PLAYLIST_STAGES key. */
    stage: text('stage').notNull(),
    title: text('title').notNull(),
    artist: text('artist'),
    url: text('url'),
    note: text('note'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('wedding_song_wedding_idx').on(t.weddingId, t.stage, t.sortOrder)],
);

// ---------- vendor finances ----------
/** Business expenses (the vendor's own costs), with an optional receipt file. */
export const vendorExpense = pgTable(
  'vendor_expense',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    spentOn: date('spent_on').notNull(),
    /** EXPENSE_CATEGORIES key. */
    category: text('category').notNull().default('other'),
    receiptUrl: text('receipt_url'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vendor_expense_vendor_idx').on(t.vendorId, t.spentOn)],
);

/**
 * Documents the business issues to clients (receipts, quotes, payment requests).
 * Numbered per vendor and kind; never edited after issue (a correction is a new document).
 */
export const clientDocument = pgTable(
  'client_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    /** DOCUMENT_KINDS key. */
    kind: text('kind').notNull(),
    number: integer('number').notNull(),
    issuedOn: date('issued_on').notNull(),
    leadId: uuid('lead_id').references(() => lead.id, { onDelete: 'set null' }),
    clientName: text('client_name').notNull(),
    clientPhone: text('client_phone'),
    clientEmail: text('client_email'),
    description: text('description').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    paymentMethod: text('payment_method'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('client_document_number_uq').on(t.vendorId, t.kind, t.number),
    index('client_document_vendor_idx').on(t.vendorId, t.issuedOn),
  ],
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

// ---------- vendor client payments (spec §13) ----------
/**
 * Payments a vendor records against a client (deposit, balance...), paid in or outside the app.
 * `paid_at` is only ever set by an explicit user action (spec §13: never from an AI guess).
 */
export const leadPayment = pgTable(
  'lead_payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => lead.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    dueDate: date('due_date'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    note: text('note'),
    ...timestamps,
  },
  (t) => [index('lead_payment_lead_idx').on(t.leadId), check('lead_payment_amount_ck', sql`${t.amountAgorot} >= 0`)],
);

// ---------- couple planning (spec §7) ----------
export const task = pgTable(
  'task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    notes: text('notes'),
    dueDate: date('due_date'),
    remindAt: timestamp('remind_at', { withTimezone: true }),
    doneAt: timestamp('done_at', { withTimezone: true }),
    categorySlug: text('category_slug').references(() => category.slug),
    /** Set on auto-generated tasks so regeneration never duplicates them. */
    templateKey: text('template_key'),
    ...timestamps,
  },
  (t) => [
    index('task_wedding_due_idx').on(t.weddingId, t.dueDate),
    unique('task_wedding_template_uq').on(t.weddingId, t.templateKey),
  ],
);

/** One line of the wedding budget (spec §7.2). A SOON vendor or an external one. */
export const budgetItem = pgTable(
  'budget_item',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    /** BUDGET_CATEGORIES key (venue, photography, ..., other). */
    category: text('category').notNull(),
    title: text('title').notNull(),
    vendorId: uuid('vendor_id').references(() => vendor.id, { onDelete: 'set null' }),
    vendorName: text('vendor_name'),
    plannedAgorot: integer('planned_agorot'),
    /** What was actually agreed (the commitment). */
    actualAgorot: integer('actual_agorot'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('budget_item_wedding_idx').on(t.weddingId),
    // One line per category; "other" may repeat.
    uniqueIndex('budget_item_wedding_category_uq').on(t.weddingId, t.category).where(sql`${t.category} <> 'other'`),
  ],
);

/** Scheduled / paid payments for a budget line (spec §7.2: due dates and reminders). */
export const weddingPayment = pgTable(
  'wedding_payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    budgetItemId: uuid('budget_item_id').references(() => budgetItem.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    dueDate: date('due_date'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('wedding_payment_wedding_idx').on(t.weddingId, t.dueDate),
    check('wedding_payment_amount_ck', sql`${t.amountAgorot} >= 0`),
  ],
);

export const guest = pgTable(
  'guest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    side: guestSideEnum('side').notNull().default('shared'),
    phone: text('phone'),
    rsvp: rsvpStatusEnum('rsvp').notNull().default('invited'),
    partySize: integer('party_size').notNull().default(1),
    tableLabel: text('table_label'),
    notes: text('notes'),
    /** When the guest answered on the wedding site (RSVP). */
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('guest_wedding_idx').on(t.weddingId), check('guest_party_size_ck', sql`${t.partySize} between 1 and 50`)],
);

/** The couple's own calendar (spec §7.3): vendor meetings, tastings, fittings, deadlines. */
export const weddingEvent = pgTable(
  'wedding_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    kind: weddingEventKindEnum('kind').notNull().default('meeting'),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    location: text('location'),
    vendorId: uuid('vendor_id').references(() => vendor.id, { onDelete: 'set null' }),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [
    index('wedding_event_wedding_idx').on(t.weddingId, t.startsAt),
    check('wedding_event_range_ck', sql`${t.endsAt} IS NULL OR ${t.startsAt} < ${t.endsAt}`),
  ],
);

// ---------- reviews & trust (spec §17) ----------
export const review = pgTable(
  'review',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    authorUserId: text('author_user_id').references(() => user.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    ratingProfessionalism: integer('rating_professionalism'),
    ratingService: integer('rating_service'),
    ratingAvailability: integer('rating_availability'),
    ratingValue: integer('rating_value'),
    body: text('body').notNull(),
    /** A booked/completed lead between this wedding and vendor existed when it was written. */
    verified: boolean('verified').notNull().default(false),
    status: reviewStatusEnum('status').notNull().default('published'),
    vendorReply: text('vendor_reply'),
    vendorRepliedAt: timestamp('vendor_replied_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('review_vendor_wedding_uq').on(t.vendorId, t.weddingId),
    index('review_vendor_status_idx').on(t.vendorId, t.status),
    check(
      'review_ratings_ck',
      sql`${t.rating} between 1 and 5
        and (${t.ratingProfessionalism} is null or ${t.ratingProfessionalism} between 1 and 5)
        and (${t.ratingService} is null or ${t.ratingService} between 1 and 5)
        and (${t.ratingAvailability} is null or ${t.ratingAvailability} between 1 and 5)
        and (${t.ratingValue} is null or ${t.ratingValue} between 1 and 5)`,
    ),
  ],
);

export const reviewReport = pgTable(
  'review_report',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => review.id, { onDelete: 'cascade' }),
    reporterUserId: text('reporter_user_id').references(() => user.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('review_report_open_idx').on(t.resolvedAt, t.createdAt),
    unique('review_report_once_uq').on(t.reviewId, t.reporterUserId),
  ],
);

/** Daily profile-view counter (spec §9 analytics). One row per vendor per Israeli day. */
export const vendorStatDaily = pgTable(
  'vendor_stat_daily',
  {
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    views: integer('views').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.vendorId, t.day] })],
);

// ---------- couples community (couple <-> couple chat) ----------
/** One thread between two weddings. weddingA < weddingB keeps each pair unique. */
export const coupleChat = pgTable(
  'couple_chat',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingAId: uuid('wedding_a_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    weddingBId: uuid('wedding_b_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    aReadAt: timestamp('a_read_at', { withTimezone: true }),
    bReadAt: timestamp('b_read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('couple_chat_pair_uq').on(t.weddingAId, t.weddingBId),
    index('couple_chat_b_idx').on(t.weddingBId),
    check('couple_chat_order_ck', sql`${t.weddingAId} < ${t.weddingBId}`),
  ],
);

export const coupleChatMessage = pgTable(
  'couple_chat_message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => coupleChat.id, { onDelete: 'cascade' }),
    senderUserId: text('sender_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('couple_chat_message_chat_idx').on(t.chatId, t.createdAt)],
);

// ---------- interactive invitation (wedding site), blessings and gifts ----------
/** Invitation designs uploaded by admins; couples pick one for their invitation and site. */
export const invitationTemplate = pgTable('invitation_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Background image (admin upload). */
  backgroundUrl: text('background_url'),
  paperColor: text('paper_color').notNull().default('#FBF7F1'),
  textColor: text('text_color').notNull().default('#2B1E1C'),
  accentColor: text('accent_color').notNull().default('#B48A4E'),
  /** 'serif' (editorial) or 'sans' (clean). */
  font: text('font').notNull().default('serif'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});


/** The couple's public wedding site (/i/<slug>): the interactive invitation, RSVP, blessings and gifts. */
export const weddingSite = pgTable('wedding_site', {
  weddingId: uuid('wedding_id')
    .primaryKey()
    .references(() => wedding.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  templateId: uuid('template_id').references(() => invitationTemplate.id, { onDelete: 'set null' }),
  published: boolean('published').notNull().default(false),
  coverUrl: text('cover_url'),
  story: text('story'),
  details: jsonb('details').$type<WeddingSiteDetails>().notNull().default(sql`'{"schedule":[]}'::jsonb`),
  rsvpEnabled: boolean('rsvp_enabled').notNull().default(true),
  giftsEnabled: boolean('gifts_enabled').notNull().default(true),
  ...timestamps,
});

/** A blessing a guest left on the wedding site (with or without a gift). */
export const weddingBlessing = pgTable(
  'wedding_blessing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('wedding_blessing_wedding_idx').on(t.weddingId, t.createdAt)],
);

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;

/** A money gift to the couple through the site. SOON's fee is charged on top of the gift. */
export const weddingGift = pgTable(
  'wedding_gift',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    weddingId: uuid('wedding_id')
      .notNull()
      .references(() => wedding.id, { onDelete: 'cascade' }),
    giverName: text('giver_name').notNull(),
    giverPhone: text('giver_phone'),
    blessing: text('blessing'),
    amountAgorot: integer('amount_agorot').notNull(),
    feeAgorot: integer('fee_agorot').notNull().default(0),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('wedding_gift_wedding_idx').on(t.weddingId, t.createdAt),
    check('wedding_gift_amount_ck', sql`${t.amountAgorot} > 0 and ${t.feeAgorot} >= 0`),
  ],
);

// ---------- vendor billing ----------
/** The vendor's saved card (provider token) for the monthly plan charge. */
export const vendorPaymentMethod = pgTable('vendor_payment_method', {
  vendorId: uuid('vendor_id')
    .primaryKey()
    .references(() => vendor.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  token: text('token').notNull(),
  last4: text('last4'),
  brand: text('brand'),
  expiry: text('expiry'),
  ...timestamps,
});

/** One plan charge (a month of a paid plan). */
export const vendorCharge = pgTable(
  'vendor_charge',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vendorId: uuid('vendor_id')
      .notNull()
      .references(() => vendor.id, { onDelete: 'cascade' }),
    plan: text('plan').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('pending'),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    error: text('error'),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('vendor_charge_vendor_idx').on(t.vendorId, t.createdAt)],
);

// ---------- platform settings (admin) ----------
export const appSetting = pgTable('app_setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
