/**
 * Payment results: Upay's IPN (server-to-server) and the built-in test page.
 * Every reference is HMAC-signed by us, so a forged notification is ignored.
 */
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { db } from '../db';
import { vendorPaymentMethod, weddingGift } from '../db/schema';
import { parseBody } from '../session';
import { parseUpayIpn, payments, verifyRef, type PaymentKind, type PaymentResult } from '../services/payments';
import { renewIfDue } from './billing';

/** Applies a verified payment result. Idempotent: a gift is settled once. */
export async function applyPaymentResult(kind: PaymentKind, id: string, r: PaymentResult, log: FastifyRequest['log']) {
  if (kind === 'gift') {
    const [g] = await db.select().from(weddingGift).where(eq(weddingGift.id, id));
    if (!g || g.status !== 'pending') return;
    const expected = g.amountAgorot + g.feeAgorot;
    if (r.ok && r.amountAgorot != null && Math.abs(r.amountAgorot - expected) > 1) {
      log.warn({ id, expected, got: r.amountAgorot }, 'gift amount mismatch; not marking paid');
      return;
    }
    await db
      .update(weddingGift)
      .set(r.ok ? { status: 'paid', paidAt: new Date(), providerRef: r.providerRef ?? g.providerRef } : { status: 'failed' })
      .where(and(eq(weddingGift.id, id), eq(weddingGift.status, 'pending')));
    return;
  }
  if (kind === 'card') {
    if (!r.ok || !r.card) return;
    await db
      .insert(vendorPaymentMethod)
      .values({ vendorId: id, provider: payments.provider, token: r.card.token, last4: r.card.last4, brand: r.card.brand, expiry: r.card.expiry })
      .onConflictDoUpdate({
        target: vendorPaymentMethod.vendorId,
        set: { provider: payments.provider, token: r.card.token, last4: r.card.last4, brand: r.card.brand, expiry: r.card.expiry, updatedAt: new Date() },
      });
    // A lapsed paid plan renews as soon as a card is saved.
    await renewIfDue(id, log, { newCard: true }).catch((err) => log.error({ err, id }, 'renew after card save failed'));
  }
}

export async function paymentRoutes(app: FastifyInstance) {
  // Upay posts its notification as a form; accept form bodies in this plugin.
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(String(body))));
  });

  const ipn = async (request: FastifyRequest) => {
    const q = { ...(request.query as Record<string, string>), ...((request.body as Record<string, string> | undefined) ?? {}) };
    const ref = q.ref ?? '';
    const target = verifyRef(ref, q.sig);
    if (!target) {
      request.log.warn({ ref }, 'payment IPN with a bad signature');
      return { ok: false };
    }
    const result = parseUpayIpn(q);
    request.log.info({ ref, ok: result.ok, providerRef: result.providerRef }, 'payment IPN');
    await applyPaymentResult(target.kind, target.id, result, request.log);
    return { ok: true };
  };
  app.get('/api/payments/upay/ipn', ipn);
  app.post('/api/payments/upay/ipn', ipn);

  /** The test payment page's "pay" / "fail" buttons (test mode only). */
  app.post('/api/payments/test/complete', async (request, reply) => {
    if (!payments.testMode) return reply.status(404).send({ error: 'Not found' });
    const b = await parseBody(z.object({ ref: z.string(), sig: z.string(), ok: z.boolean(), amount: z.number().int().nonnegative() }), request.body, reply);
    if (!b) return;
    const target = verifyRef(b.ref, b.sig);
    if (!target) return reply.status(400).send({ error: 'Bad reference' });
    await applyPaymentResult(
      target.kind,
      target.id,
      {
        ok: b.ok,
        providerRef: `test-${Date.now()}`,
        amountAgorot: target.kind === 'gift' ? b.amount : null,
        card: target.kind === 'card' && b.ok ? { token: `test-${target.id.slice(0, 8)}`, last4: '4242', brand: 'Visa (בדיקה)', expiry: '12/30' } : null,
        error: b.ok ? null : 'נדחה (מצב בדיקה)',
      },
      request.log,
    );
    return { ok: true };
  });
}
