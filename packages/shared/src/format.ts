import { VENDOR_CATEGORIES } from './categories';
import { REGIONS } from './regions';

const ils = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 });

/** 1234500 agorot → "‏12,345 ₪" */
export function formatAgorot(agorot: number | null | undefined): string {
  if (agorot == null) return '';
  return ils.format(agorot / 100);
}

/** "₪5,000 – ₪12,000", "החל מ־₪5,000", or "" */
export function formatPriceRange(from: number | null | undefined, to: number | null | undefined): string {
  if (from != null && to != null && from !== to) return `${formatAgorot(from)} – ${formatAgorot(to)}`;
  if (from != null) return `החל מ־${formatAgorot(from)}`;
  if (to != null) return `עד ${formatAgorot(to)}`;
  return '';
}

/** Shekels typed by a user ("5,000") → agorot, or null when empty/invalid. */
export function shekelsToAgorot(input: string): number | null {
  const n = Number(input.replace(/[^\d.]/g, ''));
  return input.trim() && Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function agorotToShekelsInput(agorot: number | null | undefined): string {
  return agorot == null ? '' : String(Math.round(agorot / 100));
}

export function regionLabel(slug: string): string {
  return REGIONS.find((r) => r.slug === slug)?.he ?? slug;
}

export function categoryLabel(slug: string): string {
  return VENDOR_CATEGORIES.find((c) => c.slug === slug)?.he ?? slug;
}
