/** Response shapes shared by the API and the app. */
import type { MediaKind, VendorStatus } from './enums';
import type { RegionSlug } from './regions';

export type VendorMediaDTO = {
  id: string;
  kind: MediaKind;
  url: string;
  caption: string | null;
  sortOrder: number;
};

export type VendorPackageDTO = {
  id: string;
  name: string;
  description: string | null;
  priceAgorot: number | null;
  includes: string[];
  sortOrder: number;
};

export type VendorFaqDTO = {
  id: string;
  question: string;
  answer: string;
  /** FAQ_TEMPLATES key when the answer was picked from ready choices. */
  templateKey: string | null;
  sortOrder: number;
};

/** What couples see on the vendor page. No direct phone/email — contact goes through SOON. */
export type VendorPublicDTO = {
  id: string;
  slug: string;
  businessName: string;
  categorySlug: string;
  categoryLabel: string;
  about: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  priceFromAgorot: number | null;
  priceToAgorot: number | null;
  cancellationPolicy: string | null;
  regions: RegionSlug[];
  isFeatured: boolean;
  ratingAvg: number | null;
  reviewCount: number;
  media: VendorMediaDTO[];
  packages: VendorPackageDTO[];
  faqs: VendorFaqDTO[];
};

/** The owner's view of their own storefront. */
export type VendorOwnerDTO = VendorPublicDTO & {
  /** First name of the person behind the business (greeting). */
  contactFirstName: string | null;
  /** Chosen plan and until when it is active (trial or paid). */
  plan: import('./business').PlanKey;
  planActiveUntil: string | null;
  status: VendorStatus;
  /** Rejection / suspension reason shown to the vendor. */
  statusReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  phone: string | null;
  email: string | null;
};

// ---------- admin ----------

export type AdminVendorListItem = {
  id: string;
  slug: string;
  businessName: string;
  categoryLabel: string;
  status: VendorStatus;
  coverUrl: string | null;
  ownerEmail: string;
  submittedAt: string | null;
  updatedAt: string;
};

export type AdminVendorList = {
  items: AdminVendorListItem[];
  counts: Record<VendorStatus, number>;
};

export type AdminActionDTO = {
  id: string;
  action: string;
  adminEmail: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdminVendorDetail = {
  vendor: VendorOwnerDTO;
  owner: { id: string; name: string; email: string; createdAt: string };
  history: AdminActionDTO[];
};

// ---------- couples ----------

export type WeddingCategoryDTO = { slug: string; label: string; status: 'needed' | 'closed' };

export type WeddingDTO = {
  id: string;
  partner1Name: string;
  partner2Name: string;
  /** YYYY-MM-DD */
  weddingDate: string | null;
  region: RegionSlug | null;
  venueName: string | null;
  budgetTotalAgorot: number | null;
  coverImageUrl: string | null;
  categories: WeddingCategoryDTO[];
};

/** Availability of a vendor on one date, as couples see it (spec §5). */
export type DayAvailability = 'available' | 'booked' | 'unknown';

/** A search-result / saved / recommendation card (spec §5). */
export type VendorCardDTO = {
  id: string;
  slug: string;
  businessName: string;
  categorySlug: string;
  categoryLabel: string;
  regions: RegionSlug[];
  coverUrl: string | null;
  logoUrl: string | null;
  priceFromAgorot: number | null;
  priceToAgorot: number | null;
  isFeatured: boolean;
  ratingAvg: number | null;
  reviewCount: number;
  saveCount: number;
  /** Only when the request had a date (or the couple has a wedding date). */
  availability: DayAvailability | null;
  saved: boolean;
};

export type VendorSearchResult = {
  items: VendorCardDTO[];
  nextCursor: string | null;
  total: number;
};

export type SavedVendorDTO = VendorCardDTO & { note: string | null; savedAt: string };

export type TaskDTO = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  doneAt: string | null;
  categorySlug: string | null;
  templateKey: string | null;
};

export type WeddingEventDTO = {
  id: string;
  kind: import('./enums').WeddingEventKind;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  vendorId: string | null;
  vendorName: string | null;
  notes: string | null;
  /** Set by the vendor in their calendar (match call, meeting, the event): read-only for the couple. */
  fromVendor?: boolean;
};

/** A short, contextual nudge on the couple home (spec §4). */
export type HomeInsight = { key: string; text: string; href?: string };

export type CoupleHomeDTO = {
  wedding: WeddingDTO;
  daysToGo: number | null;
  budget: { totalAgorot: number | null; committedAgorot: number; paidAgorot: number };
  vendors: { closed: number; needed: number; booked: number };
  tasks: { open: number; done: number; overdue: number; next: TaskDTO | null };
  nextEvent: WeddingEventDTO | null;
  insights: HomeInsight[];
  recommended: VendorCardDTO[];
  fresh: VendorCardDTO[];
};

export type WeddingPaymentDTO = {
  id: string;
  budgetItemId: string | null;
  title: string;
  amountAgorot: number;
  dueDate: string | null;
  paidAt: string | null;
};

export type BudgetItemDTO = {
  id: string;
  category: string;
  title: string;
  vendorId: string | null;
  vendorName: string | null;
  plannedAgorot: number | null;
  actualAgorot: number | null;
  paidAgorot: number;
  notes: string | null;
};

export type BudgetDTO = {
  totalAgorot: number | null;
  plannedAgorot: number;
  committedAgorot: number;
  paidAgorot: number;
  items: BudgetItemDTO[];
  payments: WeddingPaymentDTO[];
};

export type GuestDTO = {
  id: string;
  name: string;
  side: import('./enums').GuestSide;
  phone: string | null;
  rsvp: import('./enums').RsvpStatus;
  partySize: number;
  tableLabel: string | null;
  notes: string | null;
};

export type GuestListDTO = {
  guests: GuestDTO[];
  /** People (party sizes summed), by RSVP status. */
  people: Record<import('./enums').RsvpStatus, number> & { total: number };
};

// ---------- messaging (spec §8) ----------
export type ConversationListItem = {
  id: string;
  vendor: { id: string; slug: string; businessName: string; logoUrl: string | null; categoryLabel: string };
  couple: { weddingId: string; names: string };
  lastMessage: { body: string | null; at: string; mine: boolean } | null;
  unread: number;
  leadId: string | null;
  leadStatus: import('./enums').LeadStatus | null;
};

export type MessageDTO = { id: string; body: string | null; attachmentUrl: string | null; createdAt: string; mine: boolean };

export type ConversationDetail = {
  conversation: ConversationListItem;
  messages: MessageDTO[];
  /** When the other side last read the thread (for "seen" on my messages). */
  otherReadAt: string | null;
  /** Event details next to the chat so nobody asks twice (spec §8). */
  context: {
    eventDate: string | null;
    guestCount: number | null;
    region: string | null;
    venueName: string | null;
    quotedPriceAgorot: number | null;
  };
  viewerSide: 'vendor' | 'couple';
  /** The other side's phone (WhatsApp button). Only shared once a conversation exists. */
  otherPhone: string | null;
};

// ---------- CRM (spec §10, §13) ----------
export type LeadPaymentDTO = { id: string; title: string; amountAgorot: number; dueDate: string | null; paidAt: string | null };

export type CalendarEntryDTO = {
  id: string;
  status: import('./enums').AvailabilityStatus;
  kind: import('./enums').CalendarEntryKind;
  startsAt: string;
  endsAt: string;
  title: string | null;
  location: string | null;
  note: string | null;
  leadId: string | null;
  /** From the linked lead (no copies: spec §19). */
  clientName: string | null;
  clientPhone: string | null;
  leadStatus: import('./enums').LeadStatus | null;
  quotedPriceAgorot: number | null;
  paidAgorot: number;
  /** The couple's wedding (registered in SOON), and their names. */
  weddingId: string | null;
  coupleNames: string | null;
  depositAgorot: number | null;
};

/** A registered couple a vendor can pick (calendar / new client). Contact details stay private. */
export type CoupleSearchItem = {
  weddingId: string;
  names: string;
  weddingDate: string | null;
  region: string | null;
  /** The vendor already has this couple as a client. */
  leadId: string | null;
};

/** Free match-call slots for a vendor (ISO instants), grouped by Israeli day. */
export type CallSlotsDTO = { slotMinutes: number; days: { date: string; slots: string[] }[]; enabled: boolean };

/** The couple's own review of a vendor (for editing). */
export type MyReviewDTO = {
  id: string;
  rating: number;
  ratingProfessionalism: number | null;
  ratingService: number | null;
  ratingAvailability: number | null;
  ratingValue: number | null;
  body: string;
} | null;

export type CommunityCoupleDTO = {
  weddingId: string;
  names: string;
  weddingDate: string | null;
  region: string | null;
  bio: string | null;
  /** Vendors this couple booked through SOON (category labels), for "ask them about…". */
  bookedCategories: string[];
  chatId: string | null;
};

export type CoupleChatListItem = {
  id: string;
  other: { weddingId: string; names: string };
  lastMessage: { body: string; at: string; mine: boolean } | null;
  unread: number;
};

export type CoupleChatDetail = {
  chat: CoupleChatListItem;
  messages: { id: string; body: string; createdAt: string; mine: boolean }[];
};

export type LeadListItem = {
  id: string;
  clientName: string;
  source: import('./enums').LeadSource;
  status: import('./enums').LeadStatus;
  eventDate: string | null;
  location: string | null;
  guestCount: number | null;
  quotedPriceAgorot: number | null;
  nextAction: string | null;
  nextActionAt: string | null;
  conversationId: string | null;
  unread: number;
  updatedAt: string;
};

export type LeadDetailDTO = LeadListItem & {
  clientPhone: string | null;
  clientEmail: string | null;
  notes: string | null;
  packageName: string | null;
  weddingId: string | null;
  payments: LeadPaymentDTO[];
  calendar: CalendarEntryDTO[];
  createdAt: string;
};

export type LeadsDTO = { items: LeadListItem[]; counts: Partial<Record<import('./enums').LeadStatus, number>> };

export type VendorDashboardDTO = {
  newLeads: number;
  activeClients: number;
  upcomingEvents: number;
  bookedDates: number;
  unreadMessages: number;
  views30: number;
  views7: number;
  saves: number;
  bookedRevenueAgorot: number;
  collectedAgorot: number;
  reviewAvg: number | null;
  reviewCount: number;
  upcoming: CalendarEntryDTO[];
  followUps: LeadListItem[];
  viewsSeries: { day: string; views: number }[];
};

// ---------- inspiration boards (spec §6) ----------
export type BoardItemDTO = {
  id: string;
  imageUrl: string;
  vendor: { id: string; slug: string; businessName: string } | null;
  note: string | null;
  createdAt: string;
};

export type BoardDTO = {
  id: string;
  title: string;
  /** Latest item's picture, else the board's own cover. */
  coverUrl: string | null;
  itemCount: number;
};

export type BoardDetailDTO = BoardDTO & { items: BoardItemDTO[] };
