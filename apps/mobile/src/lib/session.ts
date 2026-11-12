import type { Href } from 'expo-router';

import type { UserRole } from '@soon/shared';

import { authClient } from './auth-client';

/** Current session + role. */
export function useSessionUser() {
  const { data, isPending, refetch } = authClient.useSession();
  const role = ((data?.user as { role?: UserRole | null } | undefined)?.role ?? null) as UserRole | null;
  return { session: data, user: data?.user ?? null, role, isPending, refetch };
}

/** Where each kind of user lands after sign-in / app start. */
export function homeForRole(role: UserRole | null): Href {
  switch (role) {
    case 'vendor':
      return '/vendor';
    case 'admin':
      return '/admin';
    case 'couple':
      return '/home';
    default:
      return '/choose-role';
  }
}
