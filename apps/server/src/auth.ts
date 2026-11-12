import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { emailOTP } from 'better-auth/plugins';

import { db } from './db';
import * as schema from './db/schema';
import { env, isDev } from './env';

/** Internal code used when AUTH_ACCEPT_ANY_OTP is on. Never shown to users. */
export const ANY_OTP_CODE = '000000';

export function isAdminEmail(email: string | undefined | null) {
  return Boolean(email && env.ADMIN_EMAILS.includes(email.trim().toLowerCase()));
}

/** The app's deep-link scheme (apps/mobile/app.json → expo.scheme). */
const APP_SCHEME = 'soon://';

const socialProviders: Parameters<typeof betterAuth>[0]['socialProviders'] = {};
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}
if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: env.APPLE_CLIENT_ID,
    clientSecret: env.APPLE_CLIENT_SECRET,
    appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
  };
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  trustedOrigins: [
    APP_SCHEME,
    ...env.WEB_ORIGINS,
    'https://appleid.apple.com',
    // Expo Go / dev client deep links — development only.
    ...(isDev ? ['exp://', 'exp://**'] : []),
  ],
  user: {
    additionalFields: {
      // Set by our own onboarding endpoint, never directly by the client at sign-up.
      role: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Emails in ADMIN_EMAILS become admins on first sign-in.
        // (Existing accounts: scripts/grant-admin.ts.)
        before: async (u) => ({ data: { ...u, role: isAdminEmail(u.email) ? 'admin' : null } }),
      },
    },
  },
  socialProviders,
  plugins: [
    expo(),
    // Third sign-in method (spec §2: "additional method per dev decision"): email one-time code.
    emailOTP({
      // Dev shortcut: every issued code is the same internal value, and app.ts rewrites
      // whatever the user typed to it — so ANY code signs in. Off unless AUTH_ACCEPT_ANY_OTP=true.
      // Admin emails are never covered: they always get a real random code.
      ...(env.AUTH_ACCEPT_ANY_OTP
        ? { generateOTP: ({ email }: { email: string }) => (isAdminEmail(email) ? undefined : ANY_OTP_CODE) }
        : {}),
      async sendVerificationOTP({ email, otp, type }) {
        if (isAdminEmail(email)) {
          // TODO: email it once a provider is configured. Until then: `docker compose logs server`.
          console.log(`[auth] ADMIN ${type} code for ${email}: ${otp}`);
          return;
        }
        if (env.AUTH_ACCEPT_ANY_OTP) {
          console.log(`[auth] AUTH_ACCEPT_ANY_OTP: any ${type} code will be accepted for ${email}`);
          return;
        }
        // TODO: send via an email provider (e.g. Resend). Until then, dev-only console.
        if (isDev) {
          console.log(`[auth] ${type} OTP for ${email}: ${otp}`);
          return;
        }
        throw new Error('Email delivery is not configured yet');
      },
    }),
  ],
});

export const enabledSocialProviders = Object.keys(socialProviders);
