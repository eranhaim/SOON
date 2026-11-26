/**
 * Sign-in with Google / Apple (Better Auth social providers). The server lists the providers
 * that have keys (GET /api/meta); a button shows only for those.
 */
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import type { UserRole } from '@soon/shared';

import { authClient } from './auth-client';
import { useApiQuery } from './query';

export type Provider = 'google' | 'apple';

export function useAuthProviders(): Provider[] {
  const meta = useApiQuery<{ authProviders: Provider[] }>(['meta'], '/api/meta', { staleTime: Infinity });
  return meta.data?.authProviders ?? [];
}

export const linkedAccountsKey = ['auth-accounts'] as const;

/** How the signed-in user can sign in: 'credential' (email + password), 'google', 'apple'. */
export function useLinkedAccounts() {
  return useQuery({
    queryKey: linkedAccountsKey,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) throw new Error(error.message ?? 'accounts');
      return data.map((a) => a.providerId);
    },
  });
}

/** Paths inside the app only (no "//host" or "/\host" tricks). */
export const safeNext = (next: string | undefined | null) => (next && /^\/(?![/\\])/.test(next) ? next : null);

const webOrigin = () => (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Adds Google to an existing (email) account. Google returns to `path` with ?linked=google,
 * or with ?error=<code>. Linking needs the same email address on both accounts.
 */
export async function linkGoogle(path: string) {
  const origin = webOrigin();
  const { error } = await authClient.linkSocial({
    provider: 'google',
    callbackURL: `${origin}${path}?linked=google`,
    errorCallbackURL: `${origin}${path}`,
  });
  return error;
}

/** Hebrew text for a failed linkGoogle (?error=<code>). */
export function linkErrorText(code: string) {
  if (code === 'email_does_not_match') return 'צריך לבחור ב־Google את אותו אימייל של החשבון ב־SOON.';
  if (code === 'account_already_linked_to_different_user') return 'חשבון ה־Google הזה כבר מחובר לחשבון SOON אחר.';
  if (code === 'access_denied') return 'החיבור בוטל.';
  return 'החיבור לא הצליח. נסו שוב.';
}

/**
 * Starts the provider's sign-in. The provider returns to /home (which saves the role and
 * routes on), or to /sign-in with ?error=<code> when it fails.
 */
export async function signInWith(provider: Provider, opts: { role?: UserRole; next?: string | null } = {}) {
  const q = new URLSearchParams();
  if (opts.role) q.set('role', opts.role);
  if (opts.next) q.set('next', opts.next);
  const query = q.size ? `?${q}` : '';
  // Web: an absolute URL, because the API may live on another origin (local development).
  const origin = webOrigin();
  const { error } = await authClient.signIn.social({
    provider,
    callbackURL: `${origin}/home${query}`,
    errorCallbackURL: `${origin}/sign-in${query}`,
  });
  return error;
}

/** Hebrew text for the ?error=<code> that the provider sign-in returns with. */
export function socialErrorText(code: string | undefined): string | undefined {
  if (!code) return undefined;
  if (code === 'access_denied') return 'ההתחברות בוטלה. אפשר לנסות שוב בכל רגע.';
  if (code === 'account_not_linked') return 'כבר יש חשבון עם האימייל הזה. היכנסו עם האימייל והסיסמה, ואז תוכלו לחבר את Google בהגדרות.';
  return 'ההתחברות לא הצליחה. נסו שוב או היכנסו עם אימייל.';
}
