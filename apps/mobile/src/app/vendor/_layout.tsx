import { Redirect, Stack, useSegments } from 'expo-router';
import type { ReactNode } from 'react';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { homeForRole, useSessionUser } from '@/lib/session';
import { useVendor, VendorProvider } from '@/lib/vendor-context';
import { colors } from '@/theme/tokens';

/** Vendor area: signed-in vendors (and admins) only. */
export default function VendorLayout() {
  const { session, role, isPending } = useSessionUser();
  if (isPending) return <Loading />;
  if (!session) return <Redirect href="/choose-role" />;
  if (role !== 'vendor' && role !== 'admin') return <Redirect href={homeForRole(role)} />;

  return (
    <VendorProvider>
      <VendorGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </VendorGate>
    </VendorProvider>
  );
}

/**
 * Every vendor screen except onboarding needs the storefront loaded. Gating here (not per
 * screen) keeps deep links and page refreshes on /vendor/portfolio etc. working.
 */
function VendorGate({ children }: { children: ReactNode }) {
  const { vendor, loading, error, reload } = useVendor();
  const segments = useSegments() as string[];
  const onOnboarding = segments.includes('onboarding');

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen title="לא הצלחנו לטעון">
        <Text color={colors.inkSoft}>בדקו את החיבור לאינטרנט ונסו שוב.</Text>
        <Button label="נסו שוב" onPress={reload} />
      </Screen>
    );
  }
  if (!vendor && !onOnboarding) return <Redirect href="/vendor/onboarding" />;
  return <>{children}</>;
}
