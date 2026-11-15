/**
 * Demo helpers. While the app is shown to customers, the Apple / Google buttons and the
 * profile's "switch side" tool sign in to seeded demo accounts (see apps/server seed-demo).
 */
import { router } from 'expo-router';

import { api } from './api';
import { authClient } from './auth-client';
import { queryClient } from './query';
import { homeForRole } from './session';

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_ACCOUNTS = {
  couple: 'couple@demo.soon',
  vendor: 'vendor@demo.soon',
} as const;

export type DemoSide = keyof typeof DEMO_ACCOUNTS;

/** Sign in as the demo couple or the demo vendor, then open that side's home. */
export async function signInDemo(side: DemoSide) {
  await authClient.signOut().catch(() => undefined);
  queryClient.clear();
  const { error } = await authClient.signIn.email({ email: DEMO_ACCOUNTS[side], password: DEMO_PASSWORD });
  if (error) throw new Error(error.message ?? 'demo sign-in failed');
  router.replace(homeForRole(side));
}

/** Restore every demo account to its seeded state. */
export async function resetDemo() {
  await api('/api/demo/reset', { method: 'POST' });
  queryClient.clear();
}

export async function signOutToStart() {
  await authClient.signOut().catch(() => undefined);
  queryClient.clear();
  router.replace('/choose-role');
}
