/**
 * One query builds every vendor card couples see: search results, saved vendors,
 * home recommendations and comparisons. Keep card fields here so they never drift.
 */
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';

import { REGIONS, type DayAvailability, type RegionSlug, type VendorCardDTO, type VendorSearch } from '@soon/shared';

import { db } from '../db';
import { category, savedVendor, vendor, vendorFaq, vendorPackage, vendorRegion } from '../db/schema';
import { ratingSummarySql } from './ratings';
import { vendorAvailabilityOn, vendorBusyOn } from './availability';

const regionsSql = sql<RegionSlug[]>`coalesce((
  select array_agg(${vendorRegion.region} order by ${vendorRegion.region})
  from ${vendorRegion} where ${vendorRegion.vendorId} = ${vendor.id}
), '{}')`;

const saveCountSql = sql<number>`(
  select count(*)::int from ${savedVendor} where ${savedVendor.vendorId} = ${vendor.id}
)`;

function savedBySql(weddingId: string | null | undefined) {
  if (!weddingId) return sql<boolean>`false`;
  return sql<boolean>`exists (
    select 1 from ${savedVendor}
    where ${savedVendor.vendorId} = ${vendor.id} and ${savedVendor.weddingId} = ${weddingId}
  )`;
}

export type CardQuery = {
  /** Extra conditions; `vendor.status = 'approved'` is always applied. */
  where?: (SQL | undefined)[];
  /** Viewer's wedding, for the `saved` flag. */
  weddingId?: string | null;
  /** Date to compute availability for (YYYY-MM-DD). */
  date?: string | null;
  sort?: VendorSearch['sort'];
  limit?: number;
  offset?: number;
};

export async function queryVendorCards(q: CardQuery): Promise<{ items: VendorCardDTO[]; total: number }> {
  const rating = ratingSummarySql();
  const orderBy = sortClause(q.sort ?? 'relevance', rating.avg);

  const rows = await db
    .select({
      id: vendor.id,
      slug: vendor.slug,
      businessName: vendor.businessName,
      categorySlug: vendor.categorySlug,
      categoryLabel: category.labelHe,
      coverUrl: vendor.coverUrl,
      logoUrl: vendor.logoUrl,
      priceFromAgorot: vendor.priceFromAgorot,
      priceToAgorot: vendor.priceToAgorot,
      // "Recommended": set by an admin, or an active Premium plan.
      isFeatured: sql<boolean>`(${vendor.isFeatured} or ${planRankSql} = 2)`,
      regions: regionsSql,
      saveCount: saveCountSql,
      ratingAvg: rating.avg,
      reviewCount: rating.count,
      saved: savedBySql(q.weddingId),
      availability: q.date ? vendorAvailabilityOn(q.date) : sql<DayAvailability | null>`null`,
      total: sql<number>`count(*) over ()::int`,
    })
    .from(vendor)
    .innerJoin(category, eq(category.slug, vendor.categorySlug))
    .where(and(eq(vendor.status, 'approved'), ...(q.where ?? [])))
    .orderBy(...orderBy)
    .limit(q.limit ?? 20)
    .offset(q.offset ?? 0);

  return {
    total: rows[0]?.total ?? 0,
    items: rows.map(({ total: _t, ...r }) => ({
      ...r,
      ratingAvg: r.ratingAvg == null ? null : Number(r.ratingAvg),
    })),
  };
}

function sortClause(sort: VendorSearch['sort'], ratingAvg: SQL): SQL[] {
  switch (sort) {
    case 'price_asc':
      return [sql`${vendor.priceFromAgorot} asc nulls last`, asc(vendor.id)];
    case 'price_desc':
      return [sql`coalesce(${vendor.priceToAgorot}, ${vendor.priceFromAgorot}) desc nulls last`, asc(vendor.id)];
    case 'popular':
      return [sql`${saveCountSql} desc`, desc(vendor.createdAt)];
    case 'rating':
      return [sql`${ratingAvg} desc nulls last`, sql`${saveCountSql} desc`, asc(vendor.id)];
    case 'relevance':
    default:
      // Clear ordering policy (spec §17): active Premium, then active Pro, then admin-featured,
      // then completeness and popularity.
      return [
        sql`${planRankSql} desc`,
        desc(vendor.isFeatured),
        sql`(${vendor.coverUrl} is not null) desc`,
        sql`${saveCountSql} desc`,
        desc(vendor.createdAt),
      ];
  }
}

/** 2 = active Premium, 1 = active Pro, 0 = Basic or lapsed (plan benefits in search). */
const planRankSql = sql<number>`(case when ${vendor.planActiveUntil} > now()
  then case ${vendor.plan} when 'premium' then 2 when 'pro' then 1 else 0 end else 0 end)`;

/** Filters for the search endpoint (spec §5). */
export function searchFilters(s: VendorSearch): (SQL | undefined)[] {
  const words = (s.q ?? '').split(/\s+/).filter((w) => w.length > 0).slice(0, 6);
  return [
    s.category ? eq(vendor.categorySlug, s.category) : undefined,
    s.region
      ? sql`exists (select 1 from ${vendorRegion} where ${vendorRegion.vendorId} = ${vendor.id} and ${vendorRegion.region} = ${s.region})`
      : undefined,
    // Price overlap: the vendor's range intersects the couple's [min, max].
    s.priceMax != null
      ? sql`coalesce(${vendor.priceFromAgorot}, ${vendor.priceToAgorot}) <= ${s.priceMax}`
      : undefined,
    s.priceMin != null
      ? sql`coalesce(${vendor.priceToAgorot}, ${vendor.priceFromAgorot}) >= ${s.priceMin}`
      : undefined,
    ...words.map((w) => matchesWordSql(w)),
    s.date && s.onlyAvailable ? sql`not ${vendorBusyOn(s.date)}` : undefined,
  ];
}

const REGION_LABELS: [string, string][] = REGIONS.map((r) => [r.slug, r.he]);

/** Escapes LIKE wildcards in user input. */
const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * One search word against every vendor field couples might type: name, category, about,
 * packages (name, description, what's included), FAQ, service regions, cancellation policy.
 */
function matchesWordSql(word: string): SQL {
  const like = likePattern(word);
  const regionSlugs = REGION_LABELS.filter(([, he]) => he.includes(word)).map(([slug]) => slug);
  const regionMatch = regionSlugs.length
    ? sql`or exists (select 1 from ${vendorRegion} r where r.vendor_id = ${vendor.id}
        and r.region in (${sql.join(
          regionSlugs.map((x) => sql`${x}`),
          sql`, `,
        )}))`
    : sql``;
  return sql`(
    ${vendor.businessName} ilike ${like}
    or ${category.labelHe} ilike ${like}
    or ${vendor.about} ilike ${like}
    or ${vendor.cancellationPolicy} ilike ${like}
    or exists (select 1 from ${vendorPackage} p where p.vendor_id = ${vendor.id}
      and (p.name ilike ${like} or p.description ilike ${like} or array_to_string(p.includes, ' ') ilike ${like}))
    or exists (select 1 from ${vendorFaq} f where f.vendor_id = ${vendor.id}
      and (f.question ilike ${like} or f.answer ilike ${like}))
    ${regionMatch}
  )`;
}
