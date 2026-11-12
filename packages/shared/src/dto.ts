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
  media: VendorMediaDTO[];
  packages: VendorPackageDTO[];
  faqs: VendorFaqDTO[];
};

/** The owner's view of their own storefront. */
export type VendorOwnerDTO = VendorPublicDTO & {
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
