/** Service regions in Israel. Used for vendor service areas and couple wedding location. */
export const REGIONS = [
  { slug: 'north', he: 'צפון' },
  { slug: 'haifa', he: 'חיפה והקריות' },
  { slug: 'sharon', he: 'השרון' },
  { slug: 'center', he: 'מרכז' },
  { slug: 'tel_aviv', he: 'תל אביב והסביבה' },
  { slug: 'jerusalem', he: 'ירושלים והסביבה' },
  { slug: 'shfela', he: 'שפלה' },
  { slug: 'south', he: 'דרום' },
  { slug: 'eilat', he: 'אילת והערבה' },
] as const;

export type RegionSlug = (typeof REGIONS)[number]['slug'];
export const REGION_SLUGS = REGIONS.map((r) => r.slug) as [RegionSlug, ...RegionSlug[]];
