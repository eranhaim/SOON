import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';

import { db } from './db';
import * as schema from './db/schema';
import { env, isDev } from './env';

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
    // Couples often have a personal and a work Google account: always let them choose.
    prompt: 'select_account',
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
  // Temporary sign-in method until Google-only login: email + password, no email verification.
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 6,
  },
  user: {
    additionalFields: {
      // Set by our own onboarding endpoint, never directly by the client at sign-up.
      role: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: false },
      bannedAt: { type: 'date', required: false, input: false },
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
  plugins: [expo()],
});

export const enabledSocialProviders = Object.keys(socialProviders);
