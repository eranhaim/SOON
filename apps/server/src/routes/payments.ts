/**
 * Payment results: Upay's IPN (server-to-server) and the built-in test page.
 * Every reference is HMAC-signed by us, so a forged notification is ignored.
 */
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { db } from '../db';
import { vendor, vendorCharge, vendorPaymentMethod, wedding, weddingGift, weddingSite } from '../db/schema';
import { env } from '../env';
import { parseBody } from '../session';
import { parseUpayIpn, payments, upayRedirectForm, verifyRef, type PaymentKind, type PaymentResult } from '../services/payments';
import { renewIfDue } from './billing';

const PUBLIC_URL = env.BETTER_AUTH_URL.replace(/\/$/, '');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** What a payment reference is for: amount, text and where the payer comes back. Null if not payable. */
async function payable(kind: PaymentKind, id: string) {
  if (kind === 'gift') {
    const [g] = await db
      .select({ g: weddingGift, p1: wedding.partner1Name, p2: wedding.partner2Name, slug: weddingSite.slug })
      .from(weddingGift)
      .innerJoin(wedding, eq(wedding.id, weddingGift.weddingId))
      .innerJoin(weddingSite, eq(weddingSite.weddingId, weddingGift.weddingId))
      .where(eq(weddingGift.id, id));
    if (!g || g.g.status !== 'pending') return null;
    return {
      amountAgorot: g.g.amountAgorot + g.g.feeAgorot,
      description: `מתנה ל${g.p1} ו${g.p2}`,
      returnUrl: `${PUBLIC_URL}/i/${g.slug}?gift=${id}`,
    };
  }
  if (kind === 'charge') {
    const [c] = await db
      .select({ c: vendorCharge, name: vendor.businessName })
      .from(vendorCharge)
      .innerJoin(vendor, eq(vendor.id, vendorCharge.vendorId))
      .where(eq(vendorCharge.id, id));
    if (!c || c.c.status !== 'pending') return null;
    return { amountAgorot: c.c.amountAgorot, description: `מנוי SOON · ${c.name}`, returnUrl: `${PUBLIC_URL}/vendor/subscription?paid=${id}` };
  }
  return null;
}

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
  if (kind === 'charge') {
    // A plan month paid on Upay's page (redirect mode): mark paid and extend the plan.
    const [c] = await db.select().from(vendorCharge).where(eq(vendorCharge.id, id));
    if (!c || c.status !== 'pending') return;
    if (r.ok && r.amountAgorot != null && Math.abs(r.amountAgorot - c.amountAgorot) > 1) {
      log.warn({ id, expected: c.amountAgorot, got: r.amountAgorot }, 'plan charge amount mismatch; not marking paid');
      return;
    }
    if (!r.ok) {
      await db.update(vendorCharge).set({ status: 'failed', error: r.error }).where(and(eq(vendorCharge.id, id), eq(vendorCharge.status, 'pending')));
      return;
    }
    await db.transaction(async (tx) => {
      const [done] = await tx
        .update(vendorCharge)
        .set({ status: 'paid', providerRef: r.providerRef })
        .where(and(eq(vendorCharge.id, id), eq(vendorCharge.status, 'pending')))
        .returning({ id: vendorCharge.id });
      if (done) await tx.update(vendor).set({ plan: c.plan, planActiveUntil: c.periodEnd }).where(eq(vendor.id, c.vendorId));
    });
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
    // Field names only (no card data), to learn the exact format of each Upay page.
    request.log.info({ ref, ok: result.ok, providerRef: result.providerRef, amount: result.amountAgorot, fields: Object.keys(q) }, 'payment IPN');
    await applyPaymentResult(target.kind, target.id, result, request.log);
    return { ok: true };
  };
  app.get('/api/payments/upay/ipn', ipn);
  app.post('/api/payments/upay/ipn', ipn);

  /**
   * Redirect mode: an HTML page that posts Upay's payment form from the payer's browser
   * (Upay's page needs the payer's browser: it uses reCAPTCHA). Amount and texts come from our DB.
   */
  app.get<{ Querystring: { ref?: string; sig?: string } }>('/api/payments/upay/go', async (request, reply) => {
    const ref = request.query.ref ?? '';
    const target = verifyRef(ref, request.query.sig);
    const page = (body: string) => reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-store').send(
      `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>מעבר לתשלום</title>` +
        `<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FBF7F1;color:#2B1E1C;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;text-align:center}` +
        `.c{max-width:360px;padding:32px}button{margin-top:16px;padding:14px 28px;border:0;border-radius:999px;background:#6E1E3A;color:#fff;font-size:16px;cursor:pointer}</style></head>` +
        `<body><div class="c">${body}</div></body></html>`,
    );
    if (payments.mode !== 'redirect' || !target) return page('<h2>הקישור לא תקין</h2>');
    const p = await payable(target.kind, target.id);
    if (!p) return page('<h2>התשלום הזה כבר הושלם או בוטל</h2>');
    const form = upayRedirectForm({ ref, ...p });
    const inputs = Object.entries(form.fields)
      .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
      .join('');
    return page(
      `<h2>מעבירים אתכם לדף התשלום המאובטח של Upay…</h2>` +
        `<form id="f" method="post" action="${esc(form.action)}">${inputs}<button type="submit">להמשך לתשלום</button></form>` +
        `<script>document.getElementById('f').submit()</script>`,
    );
  });

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
