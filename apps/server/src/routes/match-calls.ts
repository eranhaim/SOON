/**
 * Match calls (שיחות התאמה): a couple books a short call in the vendor's free call hours,
 * or asks the vendor to call them back. Both open the couple–vendor thread and the lead.
 */
import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import {
  addDays,
  APP_TIME_ZONE,
  callbackRequestSchema,
  callBookingSchema,
  DEFAULT_MATCH_CALLS,
  formatDayShortHe,
  todayIso,
  type CallSlotsDTO,
  type MatchCallSettings,
} from '@soon/shared';

import { db } from '../db';
import { availabilityEntry, conversation, lead, user, vendor } from '../db/schema';
import { badRequest, conflict, isExclusionViolation, isUuid, notFound } from '../http';
import { parseBody, requireWedding } from '../session';
import { openThread, postMessage } from './conversations';

const DAYS_AHEAD = 14;
/** No calls sooner than this from now. */
const MIN_LEAD_MS = 2 * 3600_000;

/** Offset (ms) of the app time zone from UTC at `instant`. */
function tzOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - instant;
}

/** "2027-06-22" + "10:20" in Israel → the UTC instant. */
function israelTime(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - tzOffsetMs(guess);
  return guess - tzOffsetMs(first);
}

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmmOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

function callSettingsOf(settings: unknown): MatchCallSettings {
  const s = (settings as { matchCalls?: Partial<MatchCallSettings> } | null)?.matchCalls;
  return { ...DEFAULT_MATCH_CALLS, ...(s ?? {}) };
}

/** Free slots per Israeli day, without times that overlap anything already in the vendor's calendar. */
async function freeSlots(vendorId: string, cfg: MatchCallSettings, fromDate = todayIso(), days = DAYS_AHEAD) {
  const result: { date: string; slots: string[] }[] = [];
  if (!cfg.enabled || !cfg.days.length) return result;
  const windowStart = israelTime(fromDate, '00:00');
  const windowEnd = israelTime(addDays(fromDate, days), '00:00');
  const busy = await db
    .select({ s: availabilityEntry.startsAt, e: availabilityEntry.endsAt })
    .from(availabilityEntry)
    .where(
      and(
        eq(availabilityEntry.vendorId, vendorId),
        inArray(availabilityEntry.status, ['booked', 'pending', 'unavailable']),
        lt(availabilityEntry.startsAt, new Date(windowEnd)),
        gt(availabilityEntry.endsAt, new Date(windowStart)),
      ),
    );
  const earliest = Date.now() + MIN_LEAD_MS;
  const step = cfg.slotMinutes;
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    if (!cfg.days.includes(dayOfWeek(date))) continue;
    const slots: string[] = [];
    for (let m = toMinutes(cfg.from); m + step <= toMinutes(cfg.to); m += step) {
      const start = israelTime(date, hhmmOf(m));
      const end = start + step * 60_000;
      if (start < earliest) continue;
      if (busy.some((b) => b.s.getTime() < end && b.e.getTime() > start)) continue;
      slots.push(new Date(start).toISOString());
    }
    if (slots.length) result.push({ date, slots });
  }
  return result;
}

const timeHe = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

async function approvedVendor(id: string) {
  if (!isUuid(id)) return null;
  const [v] = await db
    .select({ id: vendor.id, settings: vendor.settings, businessName: vendor.businessName })
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.status, 'approved')));
  return v ?? null;
}

export async function matchCallRoutes(app: FastifyInstance) {
  /** Public: the vendor's free match-call slots for the next two weeks. */
  app.get<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/call-slots', async (request, reply) => {
    const v = await approvedVendor(request.params.vendorId);
    if (!v) return notFound(reply);
    const cfg = callSettingsOf(v.settings);
    const dto: CallSlotsDTO = { enabled: cfg.enabled, slotMinutes: cfg.slotMinutes, days: await freeSlots(v.id, cfg) };
    return dto;
  });

  /** A couple books one of the free slots. */
  app.post<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/call-booking', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const v = await approvedVendor(request.params.vendorId);
    if (!v) return notFound(reply);
    const b = await parseBody(callBookingSchema, request.body, reply);
    if (!b) return;
    const cfg = callSettingsOf(v.settings);
    const start = new Date(b.startsAt);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(start);
    const free = (await freeSlots(v.id, cfg, date, 1))[0]?.slots ?? [];
    if (!free.includes(start.toISOString())) return conflict(reply, 'השעה הזו כבר לא פנויה. בחרו שעה אחרת.');

    const w = ctx.wedding;
    const conversationId = await openThread(v, w, { eventDate: w.weddingDate });
    const [c] = await db.select({ leadId: conversation.leadId }).from(conversation).where(eq(conversation.id, conversationId));
    try {
      await db.insert(availabilityEntry).values({
        vendorId: v.id,
        status: 'booked',
        kind: 'call',
        startsAt: start,
        endsAt: new Date(start.getTime() + cfg.slotMinutes * 60_000),
        title: `שיחת התאמה · ${w.partner1Name} ו${w.partner2Name}`,
        note: b.note ?? null,
        leadId: c?.leadId ?? null,
        weddingId: w.id,
      });
    } catch (err) {
      if (isExclusionViolation(err)) return conflict(reply, 'השעה הזו כבר לא פנויה. בחרו שעה אחרת.');
      throw err;
    }
    const when = `${formatDayShortHe(date)} בשעה ${timeHe(b.startsAt)}`;
    await postMessage(conversationId, ctx.user.id, `קבענו שיחת התאמה: ${when}${b.note ? `\n\n${b.note}` : ''}`, 'couple');
    return reply.status(201).send({ conversationId, when });
  });

  /** "Call me back": the vendor gets a follow-up task in the CRM and a message with the phone. */
  app.post<{ Params: { vendorId: string } }>('/api/vendors/:vendorId/callback', async (request, reply) => {
    const ctx = await requireWedding(request, reply);
    if (!ctx) return;
    const v = await approvedVendor(request.params.vendorId);
    if (!v) return notFound(reply);
    const b = await parseBody(callbackRequestSchema, request.body, reply);
    if (!b) return;
    const phone = b.phone?.trim() || ctx.user.phone || null;
    if (!phone || phone.replace(/\D/g, '').length < 9) return badRequest(reply, 'נא לכתוב מספר טלפון', 'phone');
    if (!ctx.user.phone) await db.update(user).set({ phone }).where(eq(user.id, ctx.user.id));

    const w = ctx.wedding;
    const conversationId = await openThread(v, w, { eventDate: w.weddingDate });
    const [c] = await db.select({ leadId: conversation.leadId }).from(conversation).where(eq(conversation.id, conversationId));
    if (c?.leadId) {
      await db
        .update(lead)
        .set({ nextAction: 'לחזור לזוג לשיחת התאמה', nextActionAt: new Date(), clientPhone: phone })
        .where(eq(lead.id, c.leadId));
    }
    await postMessage(
      conversationId,
      ctx.user.id,
      `נשמח שתחזרו אלינו לשיחת התאמה.\nטלפון: ${phone}${b.note ? `\n\n${b.note}` : ''}`,
      'couple',
    );
    return reply.status(201).send({ conversationId });
  });
}
