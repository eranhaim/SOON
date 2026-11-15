/**
 * One query builds every vendor card couples see: search results, saved vendors,
 * home recommendations and comparisons. Keep card fields here so they never drift.
 */
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';

import type { DayAvailability, RegionSlug, VendorCardDTO, VendorSearch } from '@soon/shared';

import { db } from '../db';
import { category, savedVendor, vendor, vendorRegion } from '../db/schema';
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
      isFeatured: vendor.isFeatured,
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
      // Featured first (spec §17: clear ordering policy), then completeness and popularity.
      return [
        desc(vendor.isFeatured),
        sql`(${vendor.coverUrl} is not null) desc`,
        sql`${saveCountSql} desc`,
        desc(vendor.createdAt),
      ];
  }
}

/** Filters for the search endpoint (spec §5). */
export function searchFilters(s: VendorSearch): (SQL | undefined)[] {
  const like = s.q ? `%${s.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
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
    like
      ? sql`(${vendor.businessName} ilike ${like} or ${vendor.about} ilike ${like} or ${category.labelHe} ilike ${like})`
      : undefined,
    s.date && s.onlyAvailable ? sql`not ${vendorBusyOn(s.date)}` : undefined,
  ];
}
