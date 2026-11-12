/**
 * What a storefront needs before it can be submitted for admin approval.
 * Shared so the server enforces exactly what the app's checklist shows.
 */
export const MIN_ABOUT_CHARS = 40;
export const MIN_GALLERY_PHOTOS = 3;

type ReadinessInput = {
  coverUrl: string | null;
  about: string | null;
  media: unknown[];
  priceFromAgorot: number | null;
  priceToAgorot: number | null;
  regions: unknown[];
};

export type ReadinessItem = { key: string; label: string; done: boolean };

export function getVendorReadiness(v: ReadinessInput): ReadinessItem[] {
  return [
    { key: 'cover', label: 'תמונת קאבר', done: Boolean(v.coverUrl) },
    {
      key: 'about',
      label: `טקסט "אודות" (לפחות ${MIN_ABOUT_CHARS} תווים)`,
      done: (v.about?.trim().length ?? 0) >= MIN_ABOUT_CHARS,
    },
    {
      key: 'gallery',
      label: `לפחות ${MIN_GALLERY_PHOTOS} תמונות בגלריה`,
      done: v.media.length >= MIN_GALLERY_PHOTOS,
    },
    { key: 'price', label: 'טווח מחירים', done: v.priceFromAgorot != null || v.priceToAgorot != null },
    { key: 'regions', label: 'אזורי שירות', done: v.regions.length > 0 },
  ];
}

export function isVendorReady(v: ReadinessInput) {
  return getVendorReadiness(v).every((i) => i.done);
}
