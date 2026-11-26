import { betterAuth } from 'better-auth';
import { getSessionFromCtx } from 'better-auth/api';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { and, eq, lt } from 'drizzle-orm';

import { db } from './db';
import * as schema from './db/schema';
import { env, isDev } from './env';

/**
 * Users whose Google / Apple sign-in was just linked into an existing account with an
 * unproven email (email + password sign-up, no verification). The provider proved that the
 * person owns the email, so a password set by whoever signed up first must not keep access.
 * Filled in the account "before" hook (the user row is still unverified there) and handled in
 * the "after" hook (Better Auth runs it once the link is saved).
 */
const unprovenLinks = new Set<string>();

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
  account: {
    accountLinking: {
      // Signing in with Google to an email that already has an account links Google to it,
      // even though SOON never verified that email (see unprovenLinks for the safety part).
      // Deprecated in Better Auth 1.7; when it is removed, such sign-ins fall back to the
      // "account_not_linked" message and the explicit "connect Google" row in settings.
      requireLocalEmailVerified: false,
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
    account: {
      create: {
        before: async (acc, ctx) => {
          unprovenLinks.delete(acc.userId); // a mark left by a link that failed to save
          if (acc.providerId === 'credential' || !ctx) return;
          // A brand-new user is not committed yet, so it is not found here: nothing to do.
          const [u] = await db.select({ verified: schema.user.emailVerified }).from(schema.user).where(eq(schema.user.id, acc.userId));
          if (!u || u.verified) return;
          // "Connect Google" from settings: the signed-in owner already proved the password.
          const current = await getSessionFromCtx(ctx).catch(() => null);
          if (current?.user.id === acc.userId) return;
          unprovenLinks.add(acc.userId);
        },
        after: async (acc) => {
          if (!unprovenLinks.delete(acc.userId)) return;
          // Drop the unproven password and every session opened with it (not the new one).
          const linkedAt = acc.createdAt ?? new Date();
          await db
            .delete(schema.account)
            .where(and(eq(schema.account.userId, acc.userId), eq(schema.account.providerId, 'credential')));
          await db.delete(schema.session).where(and(eq(schema.session.userId, acc.userId), lt(schema.session.createdAt, linkedAt)));
        },
      },
    },
  },
  socialProviders,
  plugins: [expo()],
});

export const enabledSocialProviders = Object.keys(socialProviders);
