import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/Screen';
import { homeForRole, useSessionUser } from '@/lib/session';
import { VendorProvider } from '@/lib/vendor-context';
import { colors } from '@/theme/tokens';

/** Vendor area: signed-in vendors (and admins) only. */
export default function VendorLayout() {
  const { session, role, isPending } = useSessionUser();
  if (isPending) return <Loading />;
  if (!session) return <Redirect href="/choose-role" />;
  if (role !== 'vendor' && role !== 'admin') return <Redirect href={homeForRole(role)} />;

  return (
    <VendorProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </VendorProvider>
  );
}
