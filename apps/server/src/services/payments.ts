/**
 * Card payments through Upay (Israeli clearing, app.upay.co.il API6), with a built-in test mode.
 *
 * Flows:
 *  - checkout: a hosted Upay payment page (REDIRECTDEPOSITCREDITCARDTRANSFER) for gifts;
 *  - card setup: save a card token without charging (REDIRECTSETMYCREDITCARDDETAILS) for vendor plans;
 *  - token charge: charge a saved card (DEPOSITCREDITCARDTRANSFER) for monthly plans.
 * Upay reports the result to our IPN URL. We sign each reference (HMAC) so nobody can fake one.
 *
 * Without UPAY_EMAIL + UPAY_KEY, and with PAYMENTS_TEST_MODE, the "payment page" is our own
 * test page (/pay/test) and no money moves.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../env';

export type PaymentKind = 'gift' | 'card' | 'charge';

const PUBLIC_URL = env.BETTER_AUTH_URL.replace(/\/$/, '');
const live = Boolean(env.UPAY_EMAIL && env.UPAY_KEY);

export const payments = {
  /** Real money through Upay. */
  live,
  /** Our own test page instead of Upay. */
  testMode: !live && env.PAYMENTS_TEST_MODE,
  get available() {
    return this.live || this.testMode;
  },
  provider: live ? 'upay' : 'test',
};

// ---------- signed references ----------
export const refOf = (kind: PaymentKind, id: string) => `${kind}:${id}`;

export function signRef(ref: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(`soon-pay:${ref}`).digest('base64url').slice(0, 32);
}

export function verifyRef(ref: string, sig: string | undefined): { kind: PaymentKind; id: string } | null {
  if (!sig) return null;
  const expected = Buffer.from(signRef(ref));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [kind, id] = ref.split(':') as [PaymentKind, string];
  if (!['gift', 'card', 'charge'].includes(kind) || !id) return null;
  return { kind, id };
}

const ipnUrl = (ref: string) => `${PUBLIC_URL}/api/payments/upay/ipn?ref=${encodeURIComponent(ref)}&sig=${signRef(ref)}`;

function testPageUrl(ref: string, amountAgorot: number, description: string, returnUrl: string, mode: 'pay' | 'card') {
  const q = new URLSearchParams({ ref, sig: signRef(ref), amount: String(amountAgorot), desc: description, ret: returnUrl, mode });
  return `${PUBLIC_URL}/pay/test?${q}`;
}

// ---------- Upay API ----------
type UpayResponse<T> = { success: boolean; header: { errorcode: string; errormessage: string; errordescription: string }; result: T };

/** One action after a LOGIN, in a single "msgs" call (how Upay's API6 expects it). */
async function upay<T>(mainaction: string, minoraction: string, parameters: Record<string, unknown>): Promise<T> {
  const base = env.UPAY_DEMO ? 'https://demo.upay.co.il' : 'https://app.upay.co.il';
  const header = { refername: 'UPAY', livesystem: env.UPAY_DEMO ? 0 : 1, language: 'HE' };
  const login = { email: env.UPAY_EMAIL, key: env.UPAY_KEY };
  const msgs = [
    { header, request: { mainaction: 'CONNECTION', minoraction: 'LOGIN', encoding: 'json', parameters: login } },
    { header, request: { mainaction, minoraction, encoding: 'json', parameters: { ...login, ...parameters } } },
  ];
  const body = new URLSearchParams({ msgs: JSON.stringify(msgs) });
  const res = await fetch(`${base}/API6/client/json.php`, { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Upay HTTP ${res.status}`);
  const data = (await res.json()) as { results?: UpayResponse<T>[] };
  const [loginRes, actionRes] = data.results ?? [];
  if (!loginRes?.success) throw new Error(`Upay login failed: ${loginRes?.header?.errormessage ?? 'no response'}`);
  if (!actionRes?.success) throw new Error(`Upay ${minoraction} failed: ${actionRes?.header?.errormessage ?? 'no response'}`);
  return actionRes.result;
}

const shekels = (agorot: number) => Math.round(agorot) / 100;

// ---------- public API ----------
/** A hosted payment page for one charge. Returns where to send the payer. */
export async function createCheckout(o: {
  kind: PaymentKind;
  id: string;
  amountAgorot: number;
  description: string;
  returnUrl: string;
  payerPhone?: string | null;
}): Promise<{ url: string; providerRef: string | null }> {
  const ref = refOf(o.kind, o.id);
  if (!payments.live) return { url: testPageUrl(ref, o.amountAgorot, o.description, o.returnUrl, 'pay'), providerRef: null };
  const r = await upay<{ transactions: { cashierid: number; totalamount: string; url: string }[] }>(
    'CASHIER',
    'REDIRECTDEPOSITCREDITCARDTRANSFER',
    {
      transfers: [
        {
          email: env.UPAY_EMAIL,
          amount: shekels(o.amountAgorot),
          currency: 'NIS',
          numberpayments: 1,
          productdescription: o.description.slice(0, 120),
          comment: ref,
          ipnurl: ipnUrl(ref),
          returnurl: o.returnUrl,
          ...(o.payerPhone ? { cellphonenotify: o.payerPhone } : {}),
        },
      ],
    },
  );
  const t = r.transactions[0];
  if (!t?.url) throw new Error('Upay returned no payment page');
  return { url: t.url, providerRef: String(t.cashierid) };
}

/** A hosted page that saves a card (token) without charging it. */
export async function createCardSetup(o: { kind: PaymentKind; id: string; returnUrl: string }): Promise<{ url: string }> {
  const ref = refOf(o.kind, o.id);
  if (!payments.live) return { url: testPageUrl(ref, 0, 'שמירת כרטיס אשראי', o.returnUrl, 'card') };
  const r = await upay<{ url: string }>('ACCOUNTSECURE', 'REDIRECTSETMYCREDITCARDDETAILS', {
    returnurl: o.returnUrl,
    ipnurl: ipnUrl(ref),
  });
  return { url: r.url };
}

/** Charge a saved card. Throws on failure (the message is safe to store). */
export async function chargeToken(o: { token: string; amountAgorot: number; description: string; ref: string }): Promise<{ providerRef: string }> {
  if (!payments.live) {
    if (o.token.startsWith('test-fail')) throw new Error('הכרטיס נדחה (מצב בדיקה)');
    return { providerRef: `test-${Date.now()}` };
  }
  const r = await upay<{ transactions: { cashierid: number; depositcashierid: number; transactionid: string }[] }>(
    'CASHIER',
    'DEPOSITCREDITCARDTRANSFER',
    {
      creditcardkey: o.token,
      transfers: [
        {
          email: env.UPAY_EMAIL,
          amount: shekels(o.amountAgorot),
          currency: 'NIS',
          numberpayments: 1,
          productdescription: o.description.slice(0, 120),
          comment: o.ref,
        },
      ],
    },
  );
  const t = r.transactions[0];
  if (!t) throw new Error('Upay returned no transaction');
  return { providerRef: t.transactionid || String(t.depositcashierid) };
}

/** What an Upay IPN tells us, normalized. */
export type PaymentResult = {
  ok: boolean;
  providerRef: string | null;
  /** Charged amount in agorot (checkout IPN). */
  amountAgorot: number | null;
  /** Saved card (card-setup IPN, or checkout with a token). */
  card: { token: string; last4: string | null; brand: string | null; expiry: string | null } | null;
  error: string | null;
};

export function parseUpayIpn(q: Record<string, string | undefined>): PaymentResult {
  const token = q.creditcardkey || q.token || null;
  const ok = q.errordescription ? q.errordescription === 'SUCCESS' : Boolean(token) && (!q.providererrorcode || q.providererrorcode === '0' || q.providererrorcode === '000');
  const amount = q.amount ?? q.depositamount;
  return {
    ok,
    providerRef: q.transactionid || q.depositcashierid || null,
    amountAgorot: amount && Number.isFinite(Number(amount)) ? Math.round(Number(amount) * 100) : null,
    card: token ? { token, last4: q.fourdigits ?? null, brand: q.cardname ?? null, expiry: q.expirydate ?? null } : null,
    error: ok ? null : (q.providererrordescription ?? q.errordescription ?? 'התשלום נכשל'),
  };
}
