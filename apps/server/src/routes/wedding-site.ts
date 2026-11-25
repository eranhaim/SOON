/**
 * The couple's wedding site (interactive invitation, /i/<slug>): editor for the couple, the public
 * page for guests, RSVP (into the guest list), blessings, and money gifts paid by card (SOON's fee on top).
 */
import { randomInt } from 'node:crypto';

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  blessingSchema,
  DEFAULT_GIFT_FEE_BPS,
  EMPTY_SITE_DETAILS,
  giftCheckoutSchema,
  giftFee,
  rsvpSchema,
  siteUpdateSchema,
  type InvitationTemplateDTO,
  type PublicSiteDTO,
  type SiteActivityDTO,
  type WeddingSiteDTO,
} from '@soon/shared';

import { db } from '../db';
import { appSetting, guest, invitationTemplate, wedding, weddingBlessing, weddingGift, weddingSite } from '../db/schema';
import { env } from '../env';
import { badRequest, conflict, isUniqueViolation, isUuid, notFound } from '../http';
import { getUser, parseBody, requireWedding } from '../session';
import { createCheckout, payments } from '../services/payments';
import { storage } from '../storage';
import { weddingScope } from './uploads';

const PUBLIC_URL = env.BETTER_AUTH_URL.replace(/\/$/, '');

export async function giftFeeBps(): Promise<number> {
  const [row] = await db.select({ v: appSetting.value }).from(appSetting).where(eq(appSetting.key, 'giftFeeBps'));
  const n = Number(row?.v);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_GIFT_FEE_BPS;
}

export const toTemplateDTO = (t: typeof invitationTemplate.$inferSelect): InvitationTemplateDTO => ({
  id: t.id,
  name: t.name,
  backgroundUrl: t.backgroundUrl,
  paperColor: t.paperColor,
  textColor: t.textColor,
  accentColor: t.accentColor,
  font: t.font === 'sans' ? 'sans' : 'serif',
  active: t.active,
  sortOrder: t.sortOrder,
});

const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const randomSlug = () => Array.from({ length: 6 }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join('');

type SiteRow = typeof weddingSite.$inferSelect;

function toSiteDTO(s: SiteRow): WeddingSiteDTO {
  return {
    slug: s.slug,
    published: s.published,
    templateId: s.templateId,
    coverUrl: s.coverUrl,
    story: s.story,
    details: { ...EMPTY_SITE_DETAILS, ...s.details },
    rsvpEnabled: s.rsvpEnabled,
    giftsEnabled: s.giftsEnabled,
  };
}

/** The couple's site row, created on first use (unpublished, with a random address). */
async function ensureSite(weddingId: string): Promise<SiteRow> {
  const [existing] = await db.select().from(weddingSite).where(eq(weddingSite.weddingId, weddingId));
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const [row] = await db
      .insert(weddingSite)
      .values({ weddingId, slug: randomSlug(), details: EMPTY_SITE_DETAILS })
      .onConflictDoNothing()
      .returning();
    if (row) return row;
    const [raced] = await db.select().from(weddingSite).where(eq(weddingSite.weddingId, weddingId));
    if (raced) return raced;
  }
  throw new Error('Could not allocate a site address');
}

/** A published site by address; the couple can also open their own unpublished site (preview). */
async function siteBySlug(slug: string, viewerUserId: string | null) {
  const [row] = await db
    .select({ s: weddingSite, w: wedding })
    .from(weddingSite)
    .innerJoin(wedding, eq(wedding.id, weddingSite.weddingId))
    .where(eq(weddingSite.slug, slug.toLowerCase()));
  if (!row) return null;
  if (row.s.published) return row;
  if (!viewerUserId) return null;
  const own = await db.execute<{ ok: number }>(
    sql`select 1 as ok from wedding_member where wedding_id = ${row.w.id} and user_id = ${viewerUserId}`,
  );
  return own.rows.length ? row : null;
}

async function activity(weddingId: string): Promise<SiteActivityDTO> {
  const [gifts, blessings, rsvp] = await Promise.all([
    db.select().from(weddingGift).where(eq(weddingGift.weddingId, weddingId)).orderBy(desc(weddingGift.createdAt)).limit(500),
    db.select().from(weddingBlessing).where(eq(weddingBlessing.weddingId, weddingId)).orderBy(desc(weddingBlessing.createdAt)).limit(500),
    db.execute<{ yes: number; no: number; maybe: number; people: number }>(sql`
      select count(*) filter (where rsvp = 'confirmed')::int as yes,
        count(*) filter (where rsvp = 'declined')::int as no,
        count(*) filter (where rsvp = 'waiting')::int as maybe,
        coalesce(sum(party_size) filter (where rsvp = 'confirmed'), 0)::int as people
      from guest where wedding_id = ${weddingId} and responded_at is not null`),
  ]);
  const paid = gifts.filter((g) => g.status === 'paid');
  return {
    gifts: gifts
      .filter((g) => g.status !== 'failed')
      .map((g) => ({
        id: g.id,
        giverName: g.giverName,
        blessing: g.blessing,
        amountAgorot: g.amountAgorot,
        status: g.status,
        paidAt: g.paidAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
      })),
    blessings: blessings.map((b) => ({ id: b.id, name: b.name, body: b.body, createdAt: b.createdAt.toISOString() })),
    giftsTotalAgorot: paid.reduce((a, g) => a + g.amountAgorot, 0),
    rsvp: rsvp.rows[0] ?? { yes: 0, no: 0, maybe: 0, people: 0 },
  };
}

export async function weddingSiteRoutes(app: FastifyInstance) {
  // ----- couple: templates, editor, activity -----
  app.get('/api/invitation-templates', async () => {
    const rows = await db
      .select()
      .from(invitationTemplate)
      .where(eq(invitationTemplate.active, true))
      .orderBy(asc(invitationTemplate.sortOrder), asc(invitationTemplate.createdAt));
    return rows.map(toTemplateDTO);
  });

  app.get('/api/weddings/me/site', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return toSiteDTO(await ensureSite(ctx.wedding.id));
  });

  app.put('/api/weddings/me/site', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const b = await parseBody(siteUpdateSchema, request.body, reply);
    if (!b) return;
    const current = await ensureSite(ctx.wedding.id);
    if (b.templateId) {
      const ok = await db.$count(invitationTemplate, and(eq(invitationTemplate.id, b.templateId), eq(invitationTemplate.active, true)));
      if (!ok) return badRequest(reply, 'Unknown template', 'templateId');
    }
    if (b.coverUrl && !storage.keyIfOwned(b.coverUrl, `${weddingScope(ctx.wedding.id)}/images`) && !b.coverUrl.startsWith('https://images.unsplash.com/')) {
      return badRequest(reply, 'תמונה לא חוקית', 'coverUrl');
    }
    const set: Partial<typeof weddingSite.$inferInsert> = {};
    if (b.slug !== undefined) set.slug = b.slug;
    if (b.published !== undefined) set.published = b.published;
    if (b.templateId !== undefined) set.templateId = b.templateId;
    if (b.coverUrl !== undefined) set.coverUrl = b.coverUrl;
    if (b.story !== undefined) set.story = b.story || null;
    if (b.details !== undefined) {
      const merged = { ...EMPTY_SITE_DETAILS, ...current.details };
      for (const [k, v] of Object.entries(b.details)) (merged as Record<string, unknown>)[k] = v === '' ? null : v;
      set.details = merged;
    }
    if (b.rsvpEnabled !== undefined) set.rsvpEnabled = b.rsvpEnabled;
    if (b.giftsEnabled !== undefined) set.giftsEnabled = b.giftsEnabled;
    try {
      const [row] = await db.update(weddingSite).set(set).where(eq(weddingSite.weddingId, ctx.wedding.id)).returning();
      return toSiteDTO(row!);
    } catch (err) {
      if (isUniqueViolation(err)) return conflict(reply, 'הכתובת הזו כבר תפוסה. נסו כתובת אחרת.');
      throw err;
    }
  });

  app.get('/api/weddings/me/site/activity', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    return activity(ctx.wedding.id);
  });

  // ----- public: the site, RSVP, blessings, gifts -----
  app.get<{ Params: { slug: string } }>('/api/sites/:slug', async (request, reply) => {
    const viewer = await getUser(request);
    const row = await siteBySlug(request.params.slug, viewer?.id ?? null);
    if (!row) return notFound(reply);
    const { s, w } = row;
    const [tpl] = s.templateId ? await db.select().from(invitationTemplate).where(eq(invitationTemplate.id, s.templateId)) : [];
    const dto: PublicSiteDTO = {
      slug: s.slug,
      partner1Name: w.partner1Name,
      partner2Name: w.partner2Name,
      weddingDate: w.weddingDate,
      venueName: w.venueName,
      coverUrl: s.coverUrl ?? w.coverImageUrl,
      story: s.story,
      details: { ...EMPTY_SITE_DETAILS, ...s.details },
      rsvpEnabled: s.rsvpEnabled,
      giftsEnabled: s.giftsEnabled && payments.available,
      template: tpl ? toTemplateDTO(tpl) : null,
      invitation: w.invitation ? { opening: w.invitation.opening, body: w.invitation.body, closing: w.invitation.closing } : null,
      giftFeeBps: await giftFeeBps(),
      published: s.published,
    };
    return dto;
  });

  /** RSVP: matches a guest by phone (or name) in the couple's list, else adds them. */
  app.post<{ Params: { slug: string } }>('/api/sites/:slug/rsvp', async (request, reply) => {
    const row = await siteBySlug(request.params.slug, (await getUser(request))?.id ?? null);
    if (!row || !row.s.rsvpEnabled) return notFound(reply);
    const b = await parseBody(rsvpSchema, request.body, reply);
    if (!b) return;
    const status = b.attending === 'yes' ? 'confirmed' : b.attending === 'no' ? 'declined' : 'waiting';
    const digits = (b.phone ?? '').replace(/\D/g, '');
    // Same phone wins; else the same name.
    const phoneMatch = digits.length >= 9 ? sql`regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') like ${`%${digits.slice(-9)}`}` : sql`false`;
    const [match] = await db.execute<{ id: string }>(sql`
      select id from guest where wedding_id = ${row.w.id}
        and (${phoneMatch} or lower(trim(name)) = lower(${b.name}))
      order by (${phoneMatch}) desc
      limit 1`).then((r) => r.rows);
    const values = {
      rsvp: status as 'confirmed' | 'declined' | 'waiting',
      partySize: b.attending === 'no' ? 1 : b.partySize,
      respondedAt: new Date(),
      ...(b.phone ? { phone: b.phone } : {}),
      ...(b.note ? { notes: b.note } : {}),
    };
    if (match) await db.update(guest).set(values).where(eq(guest.id, match.id));
    else await db.insert(guest).values({ weddingId: row.w.id, name: b.name, side: 'shared', ...values });
    return reply.status(201).send({ ok: true });
  });

  app.post<{ Params: { slug: string } }>('/api/sites/:slug/blessings', async (request, reply) => {
    const row = await siteBySlug(request.params.slug, (await getUser(request))?.id ?? null);
    if (!row) return notFound(reply);
    const b = await parseBody(blessingSchema, request.body, reply);
    if (!b) return;
    await db.insert(weddingBlessing).values({ weddingId: row.w.id, name: b.name, body: b.body });
    return reply.status(201).send({ ok: true });
  });

  /** A gift: records it (pending) and returns the card payment page. SOON's fee is added on top. */
  app.post<{ Params: { slug: string } }>('/api/sites/:slug/gifts', async (request, reply) => {
    const row = await siteBySlug(request.params.slug, (await getUser(request))?.id ?? null);
    if (!row || !row.s.giftsEnabled) return notFound(reply);
    if (!payments.available) return reply.status(503).send({ error: 'התשלומים עוד לא פעילים' });
    const b = await parseBody(giftCheckoutSchema, request.body, reply);
    if (!b) return;
    const fee = giftFee(b.amount, await giftFeeBps());
    const [gift] = await db
      .insert(weddingGift)
      .values({
        weddingId: row.w.id,
        giverName: b.giverName,
        giverPhone: b.giverPhone ?? null,
        blessing: b.blessing ?? null,
        amountAgorot: b.amount,
        feeAgorot: fee,
        provider: payments.provider,
      })
      .returning({ id: weddingGift.id });
    try {
      const { url, providerRef } = await createCheckout({
        kind: 'gift',
        id: gift!.id,
        amountAgorot: b.amount + fee,
        description: `מתנה ל${row.w.partner1Name} ו${row.w.partner2Name}`,
        returnUrl: `${PUBLIC_URL}/i/${row.s.slug}?gift=${gift!.id}`,
        payerPhone: b.giverPhone,
      });
      if (providerRef) await db.update(weddingGift).set({ providerRef }).where(eq(weddingGift.id, gift!.id));
      return reply.status(201).send({ giftId: gift!.id, url, totalAgorot: b.amount + fee, feeAgorot: fee });
    } catch (err) {
      request.log.error({ err }, 'gift checkout failed');
      await db.update(weddingGift).set({ status: 'failed' }).where(eq(weddingGift.id, gift!.id));
      return reply.status(502).send({ error: 'לא הצלחנו לפתוח את דף התשלום. נסו שוב בעוד רגע.' });
    }
  });

  app.get<{ Params: { slug: string; id: string } }>('/api/sites/:slug/gifts/:id', async (request, reply) => {
    if (!isUuid(request.params.id)) return notFound(reply);
    const [g] = await db
      .select({ status: weddingGift.status, amount: weddingGift.amountAgorot })
      .from(weddingGift)
      .innerJoin(weddingSite, eq(weddingSite.weddingId, weddingGift.weddingId))
      .where(and(eq(weddingGift.id, request.params.id), eq(weddingSite.slug, request.params.slug.toLowerCase())));
    if (!g) return notFound(reply);
    return { status: g.status, amountAgorot: g.amount };
  });
}
