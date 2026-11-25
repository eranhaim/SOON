/**
 * Vendor plans: the first month is free; after it a saved card is charged monthly.
 * A plan whose period ends without a successful charge falls back to Basic benefits
 * (effectivePlan in @soon/shared) until a payment renews it.
 */
import { and, desc, eq, gte, isNotNull, lt, ne } from 'drizzle-orm';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { z } from 'zod';

import { PLANS, type PlanKey, type VendorBillingDTO } from '@soon/shared';

import { db } from '../db';
import { vendor, vendorCharge, vendorPaymentMethod } from '../db/schema';
import { env } from '../env';
import { parseBody, requireOwnVendor } from '../session';
import { chargeToken, createCardSetup, payments, refOf } from '../services/payments';

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
  };
}

/** Charge one month of `plan` on the saved card and extend the period. Returns false when it failed. */
async function chargePlan(vendorId: string, plan: PlanKey, log: FastifyBaseLogger): Promise<boolean> {
  const [card] = await db.select().from(vendorPaymentMethod).where(eq(vendorPaymentMethod.vendorId, vendorId));
  if (!card) return false;
  const [v] = await db.select({ until: vendor.planActiveUntil, name: vendor.businessName }).from(vendor).where(eq(vendor.id, vendorId));
  const start = Math.max(Date.now(), v?.until?.getTime() ?? 0);
  const periodEnd = new Date(start + PERIOD_MS);
  const amount = priceAgorot(plan);
  const [row] = await db
    .insert(vendorCharge)
    .values({ vendorId, plan, amountAgorot: amount, provider: payments.provider, periodEnd })
    .returning({ id: vendorCharge.id });
  try {
    const { providerRef } = await chargeToken({
      token: card.token,
      amountAgorot: amount,
      description: `SOON ${PLANS.find((p) => p.key === plan)?.name} · ${v?.name ?? ''}`,
      ref: refOf('charge', row!.id),
    });
    await db.transaction(async (tx) => {
      await tx.update(vendorCharge).set({ status: 'paid', providerRef }).where(eq(vendorCharge.id, row!.id));
      await tx.update(vendor).set({ plan, planActiveUntil: periodEnd }).where(eq(vendor.id, vendorId));
    });
    return true;
  } catch (err) {
    log.warn({ err, vendorId }, 'plan charge failed');
    await db
      .update(vendorCharge)
      .set({ status: 'failed', error: err instanceof Error ? err.message.slice(0, 300) : 'failed' })
      .where(eq(vendorCharge.id, row!.id));
    return false;
  }
}

/** Renews a paid plan whose period ends within a day, if a card is saved and no charge ran recently. */
export async function renewIfDue(vendorId: string, log: FastifyBaseLogger): Promise<void> {
  const [v] = await db.select({ plan: vendor.plan, until: vendor.planActiveUntil }).from(vendor).where(eq(vendor.id, vendorId));
  if (!v || v.plan === 'basic') return;
  if (v.until && v.until.getTime() > Date.now() + 86_400_000) return;
  // Don't retry more than once a day.
  const recent = await db.$count(vendorCharge, and(eq(vendorCharge.vendorId, vendorId), gte(vendorCharge.createdAt, new Date(Date.now() - 86_400_000))));
  if (recent) return;
  await chargePlan(vendorId, v.plan as PlanKey, log);
}

/** Hourly: renew every paid plan that is due (card saved, period ending). */
export function startRenewals(log: FastifyBaseLogger) {
  if (!payments.available) return () => undefined;
  const run = async () => {
    const due = await db
      .select({ id: vendor.id })
      .from(vendor)
      .innerJoin(vendorPaymentMethod, eq(vendorPaymentMethod.vendorId, vendor.id))
      .where(and(ne(vendor.plan, 'basic'), isNotNull(vendor.planActiveUntil), lt(vendor.planActiveUntil, new Date(Date.now() + 86_400_000))));
    for (const d of due) await renewIfDue(d.id, log).catch((err) => log.error({ err, id: d.id }, 'renewal failed'));
  };
  const timer = setInterval(() => void run().catch((err) => log.error({ err }, 'renewal run failed')), 3600_000);
  setTimeout(() => void run().catch(() => undefined), 30_000);
  return () => clearInterval(timer);
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/api/vendors/me/billing', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    return billingOf(ctx.vendor.id);
  });

  /** Hosted page to save (or replace) the card for the monthly charge. */
  app.post('/api/vendors/me/billing/card', async (request, reply) => {
    const ctx = await requireOwnVendor(request, reply);
    if (!ctx) return;
    if (!payments.available) return reply.status(503).send({ error: 'התשלומים עוד לא פעילים' });
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
    const hasCard = await db.$count(vendorPaymentMethod, eq(vendorPaymentMethod.vendorId, v.id));
    if (!hasCard) return reply.status(402).send({ error: 'כדי לשדרג צריך לשמור כרטיס אשראי', needsCard: true });
    const ok = await chargePlan(v.id, b.plan, request.log);
    if (!ok) return reply.status(402).send({ error: 'החיוב נכשל. בדקו את הכרטיס או החליפו אותו.' });
    await db.update(vendor).set({ planSince: new Date() }).where(eq(vendor.id, v.id));
    return billingOf(v.id);
  });
}

