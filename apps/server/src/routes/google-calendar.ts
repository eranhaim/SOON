/**
 * Google Calendar for vendors: a separate "SOON" calendar in the vendor's own Google account
 * (under "My calendars", not "Other calendars" like an ICS subscription). Every calendar entry
 * is pushed to it, and edits / deletions follow. Scope `calendar.app.created`: the app can only
 * see and change calendars it created.
 *
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (the same Google Cloud app as sign-in) and the
 * redirect URI <PUBLIC_URL>/api/google-calendar/callback registered in Google Cloud.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { db } from '../db';
import { availabilityEntry, lead, vendor, vendorGoogleCalendar, wedding } from '../db/schema';
import { env } from '../env';
import { requireOwnVendor } from '../session';

const PUBLIC_URL = env.BETTER_AUTH_URL.replace(/\/$/, '');
const REDIRECT_URI = `${PUBLIC_URL}/api/google-calendar/callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created openid email';
const API = 'https://www.googleapis.com/calendar/v3';

export const googleCalendarEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

const sign = (v: string) => createHmac('sha256', env.BETTER_AUTH_SECRET).update(`gcal:${v}`).digest('base64url').slice(0, 32);
function verifyState(state: string | undefined): string | null {
  const [vendorId, ts, sig] = (state ?? '').split('.');
  if (!vendorId || !ts || !sig) return null;
  const expected = Buffer.from(sign(`${vendorId}.${ts}`));
  if (expected.length !== Buffer.from(sig).length || !timingSafeEqual(expected, Buffer.from(sig))) return null;
  if (Date.now() - Number(ts) > 15 * 60_000) return null;
  return vendorId;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, ...params }),
  });
  const data = (await res.json()) as { access_token?: string; refresh_token?: string; id_token?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google token error: ${data.error ?? res.status}`);
  return data;
}

async function accessTokenFor(vendorId: string) {
  const [row] = await db.select().from(vendorGoogleCalendar).where(eq(vendorGoogleCalendar.vendorId, vendorId));
  if (!row) return null;
  const { access_token } = await tokenRequest({ grant_type: 'refresh_token', refresh_token: row.refreshToken });
  return { token: access_token!, calendarId: row.calendarId };
}

async function gapi(token: string, method: string, path: string, body?: unknown) {
  return fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Google event ids allow [a-v0-9]; a UUID without dashes fits. */
const eventIdOf = (entryId: string) => `soon${entryId.replace(/-/g, '')}`;

const STATUS_HE: Record<string, string> = { booked: 'סגור', pending: 'ממתין', unavailable: 'לא זמין', available: 'פנוי' };

/** Push one entry (create or update). Best effort: errors are stored, never thrown. */
export async function syncCalendarEntry(vendorId: string, entryId: string, log: FastifyBaseLogger) {
  if (!googleCalendarEnabled) return;
  try {
    const auth = await accessTokenFor(vendorId);
    if (!auth) return;
    const [row] = await db
      .select({ e: availabilityEntry, w1: wedding.partner1Name, w2: wedding.partner2Name, client: lead.clientName })
      .from(availabilityEntry)
      .leftJoin(lead, eq(lead.id, availabilityEntry.leadId))
      .leftJoin(wedding, eq(wedding.id, availabilityEntry.weddingId))
      .where(eq(availabilityEntry.id, entryId));
    if (!row) return deleteCalendarEntry(vendorId, entryId, log);
    const e = row.e;
    const who = row.w1 ? `${row.w1} ו${row.w2}` : row.client;
    const event = {
      id: eventIdOf(e.id),
      summary: e.title ?? who ?? 'SOON',
      location: e.location ?? undefined,
      description: [who ? `לקוח: ${who}` : null, `סטטוס: ${STATUS_HE[e.status] ?? e.status}`, e.note].filter(Boolean).join('\n'),
      start: { dateTime: e.startsAt.toISOString() },
      end: { dateTime: e.endsAt.toISOString() },
      transparency: e.status === 'available' ? 'transparent' : 'opaque',
    };
    const cal = encodeURIComponent(auth.calendarId);
    let res = await gapi(auth.token, 'PUT', `/calendars/${cal}/events/${event.id}`, event);
    if (res.status === 404) res = await gapi(auth.token, 'POST', `/calendars/${cal}/events`, event);
    if (!res.ok) throw new Error(`Google event ${res.status}`);
  } catch (err) {
    log.warn({ err, vendorId, entryId }, 'google calendar sync failed');
    await db
      .update(vendorGoogleCalendar)
      .set({ lastError: err instanceof Error ? err.message.slice(0, 200) : 'sync failed' })
      .where(eq(vendorGoogleCalendar.vendorId, vendorId));
  }
}

export async function deleteCalendarEntry(vendorId: string, entryId: string, log: FastifyBaseLogger) {
  if (!googleCalendarEnabled) return;
  try {
    const auth = await accessTokenFor(vendorId);
    if (!auth) return;
    await gapi(auth.token, 'DELETE', `/calendars/${encodeURIComponent(auth.calendarId)}/events/${eventIdOf(entryId)}`);
  } catch (err) {
    log.warn({ err, vendorId, entryId }, 'google calendar delete failed');
  }
}

async function syncAll(vendorId: string, log: FastifyBaseLogger) {
  const rows = await db.select({ id: availabilityEntry.id }).from(availabilityEntry).where(eq(availabilityEntry.vendorId, vendorId));
  for (const r of rows) await syncCalendarEntry(vendorId, r.id, log);
}

export async function googleCalendarRoutes(app: FastifyInstance) {
  app.get('/api/vendors/me/google-calendar', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const [row] = await db.select().from(vendorGoogleCalendar).where(eq(vendorGoogleCalendar.vendorId, ctx.vendor.id));
    return { available: googleCalendarEnabled, connected: Boolean(row), email: row?.googleEmail ?? null, lastError: row?.lastError ?? null };
  });

  /** Start: the Google consent page URL (the app opens it). */
  app.post('/api/vendors/me/google-calendar/connect', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!googleCalendarEnabled) return reply.status(503).send({ error: 'החיבור ל־Google עוד לא הוגדר' });
    const raw = `${ctx.vendor.id}.${Date.now()}`;
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: `${raw}.${sign(raw)}`,
    })}`;
    return { url };
  });

  /** Google sends the vendor back here: save the token, create the SOON calendar, push all entries. */
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>('/api/google-calendar/callback', async (request, reply) => {
    const vendorId = verifyState(request.query.state);
    const back = (status: string) => reply.redirect(`${PUBLIC_URL}/vendor/calendar?google=${status}`);
    if (!vendorId || !request.query.code || request.query.error) return back('cancelled');
    try {
      const tokens = await tokenRequest({ grant_type: 'authorization_code', code: request.query.code, redirect_uri: REDIRECT_URI });
      if (!tokens.refresh_token) throw new Error('no refresh token');
      const email = tokens.id_token ? (JSON.parse(Buffer.from(tokens.id_token.split('.')[1]!, 'base64url').toString()) as { email?: string }).email : undefined;
      const [v] = await db.select({ name: vendor.businessName }).from(vendor).where(eq(vendor.id, vendorId));
      const res = await gapi(tokens.access_token!, 'POST', '/calendars', { summary: `SOON · ${v?.name ?? 'יומן העסק'}`, timeZone: 'Asia/Jerusalem' });
      const cal = (await res.json()) as { id?: string };
      if (!res.ok || !cal.id) throw new Error(`create calendar ${res.status}`);
      await db
        .insert(vendorGoogleCalendar)
        .values({ vendorId, refreshToken: tokens.refresh_token, calendarId: cal.id, googleEmail: email ?? null })
        .onConflictDoUpdate({
          target: vendorGoogleCalendar.vendorId,
          set: { refreshToken: tokens.refresh_token, calendarId: cal.id, googleEmail: email ?? null, connectedAt: new Date(), lastError: null },
        });
      void syncAll(vendorId, request.log);
      return back('connected');
    } catch (err) {
      request.log.error({ err }, 'google calendar connect failed');
      return back('failed');
    }
  });

  /** Disconnect (the SOON calendar stays in Google; the vendor can delete it there). */
  app.delete('/api/vendors/me/google-calendar', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    await db.delete(vendorGoogleCalendar).where(eq(vendorGoogleCalendar.vendorId, ctx.vendor.id));
    return { available: googleCalendarEnabled, connected: false, email: null, lastError: null };
  });
}
