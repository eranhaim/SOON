import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/Screen';
import { homeForRole, useSessionUser } from '@/lib/session';
import { colors } from '@/theme/tokens';

/** Admin area (spec §17). The server enforces admin on every /api/admin call too. */
export default function AdminLayout() {
  const { session, role, isPending } = useSessionUser();
  if (isPending) return <Loading />;
  if (!session) return <Redirect href="/choose-role" />;
  if (role !== 'admin') return <Redirect href={homeForRole(role)} />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
