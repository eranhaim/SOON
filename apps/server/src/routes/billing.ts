/**
 * Vendor plans: the first month is free; after it a saved card is charged monthly.
 * A plan whose period ends without a successful charge falls back to Basic benefits
 * (effectivePlan in @soon/shared) until a payment renews it.
 */
import { and, desc, eq, gte, isNotNull, lt, ne, or, sql } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { z } from 'zod';

import { PLANS, type PlanKey, type VendorBillingDTO } from '@soon/shared';

import { db } from '../db';
import { vendor, vendorCharge, vendorPaymentMethod } from '../db/schema';
import { env } from '../env';
import { parseBody, requireOwnVendor } from '../session';
import { chargeToken, createCardSetup, createCheckout, payments, refOf } from '../services/payments';

const PUBLIC_URL = env.BETTER_AUTH_URL.replace(/\/$/, '');
const PERIOD_MS = 30 * 86_400_000;
const priceAgorot = (plan: string) => (PLANS.find((p) => p.key === plan)?.priceMonthly ?? 0) * 100;

async function billingOf(vendorId: string): Promise<VendorBillingDTO> {
  const [[v], [card], charges] = await Promise.all([
    db.select({ plan: vendor.plan, until: vendor.planActiveUntil }).from(vendor).where(eq(vendor.id, vendorId)),
    db.select().from(vendorPaymentMethod).where(eq(vendorPaymentMethod.vendorId, vendorId)),
    db.select().from(vendorCharge).where(eq(vendorCharge.vendorId, vendorId)).orderBy(desc(vendorCharge.createdAt)).limit(24),
  ]);
  return {
    plan: (v?.plan ?? 'basic') as PlanKey,
    planActiveUntil: v?.until?.toISOString() ?? null,
    card: card ? { last4: card.last4, brand: card.brand, expiry: card.expiry } : null,
    charges: charges.map((c) => ({
      id: c.id,
      plan: c.plan,
      amountAgorot: c.amountAgorot,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      error: c.error,
    })),
    paymentsLive: payments.live,
    canSaveCard: payments.supportsTokens,
  };
}

/**
 * Charge one month of `plan` on the saved card and extend the period.
 * Returns 'paid', 'failed', or 'busy' when another charge for this vendor started moments ago
 * (double tap, two tabs, the hourly job): a per-vendor lock makes "check + start" atomic.
 */
async function chargePlan(vendorId: string, plan: PlanKey, log: FastifyBaseLogger): Promise<'paid' | 'failed' | 'busy'> {
  const [card] = await db.select().from(vendorPaymentMethod).where(eq(vendorPaymentMethod.vendorId, vendorId));
  if (!card) return 'failed';
  const [v] = await db.select({ until: vendor.planActiveUntil, name: vendor.businessName }).from(vendor).where(eq(vendor.id, vendorId));
  const start = Math.max(Date.now(), v?.until?.getTime() ?? 0);
  const periodEnd = new Date(start + PERIOD_MS);
  const amount = priceAgorot(plan);
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vendor-charge:${vendorId}`}))`);
    const inFlight = await tx.$count(
      vendorCharge,
      and(
        eq(vendorCharge.vendorId, vendorId),
        or(eq(vendorCharge.status, 'pending'), eq(vendorCharge.status, 'paid')),
        gte(vendorCharge.createdAt, new Date(Date.now() - 10 * 60_000)),
      ),
    );
    if (inFlight) return null;
    const [r] = await tx
      .insert(vendorCharge)
      .values({ vendorId, plan, amountAgorot: amount, provider: payments.provider, periodEnd })
      .returning({ id: vendorCharge.id });
    return r!;
  });
  if (!row) return 'busy';
  try {
    const { providerRef } = await chargeToken({
      token: card.token,
      amountAgorot: amount,
      description: `SOON ${PLANS.find((p) => p.key === plan)?.name} · ${v?.name ?? ''}`,
      ref: refOf('charge', row!.id),
    });
    await db.transaction(async (tx) => {
      await tx.update(vendorCharge).set({ status: 'paid', providerRef }).where(eq(vendorCharge.id, row.id));
      await tx.update(vendor).set({ plan, planActiveUntil: periodEnd }).where(eq(vendor.id, vendorId));
    });
    return 'paid';
  } catch (err) {
    log.warn({ err, vendorId }, 'plan charge failed');
    await db
      .update(vendorCharge)
      .set({ status: 'failed', error: err instanceof Error ? err.message.slice(0, 300) : 'failed' })
      .where(eq(vendorCharge.id, row.id));
    return 'failed';
  }
}

/**
 * Renews a paid plan whose period ends within a day, if a card is saved.
 * The hourly job retries a failed card at most once a day; a newly saved card retries at once.
 */
export async function renewIfDue(vendorId: string, log: FastifyBaseLogger, opts: { newCard?: boolean } = {}): Promise<void> {
  const [v] = await db.select({ plan: vendor.plan, until: vendor.planActiveUntil }).from(vendor).where(eq(vendor.id, vendorId));
  if (!v || v.plan === 'basic') return;
  if (v.until && v.until.getTime() > Date.now() + 86_400_000) return;
  if (!opts.newCard) {
    const recentFailure = await db.$count(
      vendorCharge,
      and(eq(vendorCharge.vendorId, vendorId), eq(vendorCharge.status, 'failed'), gte(vendorCharge.createdAt, new Date(Date.now() - 86_400_000))),
    );
    if (recentFailure) return;
  }
  await chargePlan(vendorId, v.plan as PlanKey, log);
}

/** Hourly: renew every paid plan that is due (card saved, period ending). */
export function startRenewals(log: FastifyBaseLogger) {
  if (!payments.supportsTokens) return () => undefined;
  const run = async () => {
    const due = await db
      .select({ id: vendor.id })
      .from(vendor)
      .innerJoin(vendorPaymentMethod, eq(vendorPaymentMethod.vendorId, vendor.id))
      .where(and(ne(vendor.plan, 'basic'), isNotNull(vendor.planActiveUntil), lt(vendor.planActiveUntil, new Date(Date.now() + 86_400_000))));
    for (const d of due) await renewIfDue(d.id, log).catch((err) => log.error({ err, id: d.id }, 'renewal failed'));
  };
  const timer = setInterval(() => void run().catch((err) => log.error({ err }, 'renewal run failed')), 3600_000);
  const first = setTimeout(() => void run().catch((err) => log.error({ err }, 'renewal run failed')), 30_000);
  timer.unref();
  first.unref();
  return () => {
    clearInterval(timer);
    clearTimeout(first);
  };
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/api/vendors/me/billing', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    return billingOf(ctx.vendor.id);
  });

  /**
   * Pay one month of a plan on the payment page (when cards can't be saved). Reuses a fresh
   * unpaid charge for the same plan, so going back and forth doesn't pile up charges.
   */
  app.post('/api/vendors/me/billing/pay', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!payments.available) return reply.status(503).send({ error: 'התשלומים עוד לא פעילים' });
    const b = await parseBody(z.object({ plan: z.enum(['pro', 'premium']).optional() }), request.body ?? {}, reply);
    if (!b) return;
    const plan = (b.plan ?? ctx.vendor.plan) as PlanKey;
    if (plan === 'basic') return reply.status(400).send({ error: 'מסלול Basic חינמי' });
    const amount = priceAgorot(plan);
    const [open] = await db
      .select()
      .from(vendorCharge)
      .where(
        and(
          eq(vendorCharge.vendorId, ctx.vendor.id),
          eq(vendorCharge.status, 'pending'),
          eq(vendorCharge.plan, plan),
          gte(vendorCharge.createdAt, new Date(Date.now() - 30 * 60_000)),
        ),
      )
      .orderBy(desc(vendorCharge.createdAt))
      .limit(1);
    const start = Math.max(Date.now(), ctx.vendor.planActiveUntil?.getTime() ?? 0);
    const charge =
      open ??
      (
        await db
          .insert(vendorCharge)
          .values({ vendorId: ctx.vendor.id, plan, amountAgorot: amount, provider: payments.provider, periodEnd: new Date(start + PERIOD_MS) })
          .returning()
      )[0]!;
    try {
      const { url } = await createCheckout({
        kind: 'charge',
        id: charge.id,
        amountAgorot: charge.amountAgorot,
        description: `מנוי SOON ${PLANS.find((p) => p.key === plan)?.name} · ${ctx.vendor.businessName}`,
        returnUrl: `${PUBLIC_URL}/vendor/subscription?paid=${charge.id}`,
      });
      return { url };
    } catch (err) {
      request.log.error({ err }, 'plan checkout failed');
      return reply.status(502).send({ error: 'לא הצלחנו לפתוח את דף התשלום. נסו שוב בעוד רגע.' });
    }
  });

  /** Hosted page to save (or replace) the card for the monthly charge. */
  app.post('/api/vendors/me/billing/card', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!payments.supportsTokens) return reply.status(400).send({ error: 'שמירת כרטיס לא זמינה. אפשר לשלם לכל חודש בדף התשלום.' });
    try {
      return await createCardSetup({ kind: 'card', id: ctx.vendor.id, returnUrl: `${PUBLIC_URL}/vendor/subscription?card=1` });
    } catch (err) {
      request.log.error({ err }, 'card setup failed');
      return reply.status(502).send({ error: 'לא הצלחנו לפתוח את דף שמירת הכרטיס. נסו שוב בעוד רגע.' });
    }
  });

  app.delete('/api/vendors/me/billing/card', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    await db.delete(vendorPaymentMethod).where(eq(vendorPaymentMethod.vendorId, ctx.vendor.id));
    return billingOf(ctx.vendor.id);
  });

  /**
   * Change plan. Basic: at once. A paid plan during an active period (trial or paid): switches
   * at once, the next charge uses the new price. A paid plan with no active period: charges now
   * (a saved card is needed; otherwise 402 needsCard).
   */
  app.put('/api/vendors/me/plan', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    const b = await parseBody(z.object({ plan: z.enum(['basic', 'pro', 'premium']) }), request.body, reply);
    if (!b) return;
    const v = ctx.vendor;
    const active = v.planActiveUntil && v.planActiveUntil.getTime() > Date.now();
    if (b.plan === 'basic' || active) {
      await db
        .update(vendor)
        .set({ plan: b.plan, planSince: new Date(), ...(b.plan === 'basic' ? { planActiveUntil: null } : {}) })
        .where(eq(vendor.id, v.id));
      return billingOf(v.id);
    }
    if (!payments.supportsTokens) return reply.status(402).send({ error: 'כדי לשדרג, משלמים על החודש הראשון', needsPayment: true });
    const hasCard = await db.$count(vendorPaymentMethod, eq(vendorPaymentMethod.vendorId, v.id));
    if (!hasCard) return reply.status(402).send({ error: 'כדי לשדרג צריך לשמור כרטיס אשראי', needsCard: true });
    const result = await chargePlan(v.id, b.plan, request.log);
    if (result === 'busy') return reply.status(409).send({ error: 'חיוב כבר מתבצע. רעננו בעוד רגע.' });
    if (result === 'failed') return reply.status(402).send({ error: 'החיוב נכשל. בדקו את הכרטיס או החליפו אותו.' });
    await db.update(vendor).set({ planSince: new Date() }).where(eq(vendor.id, v.id));
    return billingOf(v.id);
  });
}

