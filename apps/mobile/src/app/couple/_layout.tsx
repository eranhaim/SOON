import { Redirect, Stack, useSegments } from 'expo-router';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { homeForRole, useSessionUser } from '@/lib/session';
import { useWedding } from '@/lib/wedding';
import { colors } from '@/theme/tokens';

/** Couple area: signed-in couples only; everything but onboarding needs a wedding. */
export default function CoupleLayout() {
  const { session, role, isPending } = useSessionUser();
  const wedding = useWedding();
  const segments = useSegments() as string[];

  if (isPending) return <Loading />;
  if (!session) return <Redirect href="/choose-role" />;
  if (role !== 'couple') return <Redirect href={homeForRole(role)} />;
  if (wedding.isPending) return <Loading />;
  if (wedding.isError) {
    return (
      <Screen title="לא הצלחנו לטעון">
        <Text color={colors.inkSoft}>בדקו את החיבור לאינטרנט ונסו שוב.</Text>
        <Button label="נסו שוב" onPress={() => wedding.refetch()} />
      </Screen>
    );
  }
  const onOnboarding = segments.includes('onboarding');
  if (!wedding.data.wedding && !onOnboarding) return <Redirect href="/couple/onboarding" />;
  if (wedding.data.wedding && onOnboarding) return <Redirect href="/couple" />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
