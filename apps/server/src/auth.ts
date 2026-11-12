import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { emailOTP } from 'better-auth/plugins';

import { db } from './db';
import * as schema from './db/schema';
import { env, isDev } from './env';

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
  socialProviders,
  plugins: [
    expo(),
    // Third sign-in method (spec §2: "additional method per dev decision"): email one-time code.
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        // TODO(week 2): send via an email provider (e.g. Resend). Until then, dev-only console.
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
