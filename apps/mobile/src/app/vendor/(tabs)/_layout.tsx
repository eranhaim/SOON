import Feather from '@expo/vector-icons/Feather';
import { Redirect, Tabs } from 'expo-router';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import type { IconName } from '@/components/ui';
import { useVendor } from '@/lib/vendor-context';
import { colors, fonts, hairline } from '@/theme/tokens';

/** Vendor navigation (spec §2): Dashboard · Calendar · Leads · Messages · Business. */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'ראשי', icon: 'grid' },
  { name: 'calendar', title: 'יומן', icon: 'calendar' },
  { name: 'leads', title: 'לידים', icon: 'users' },
  { name: 'messages', title: 'הודעות', icon: 'message-circle' },
  { name: 'business', title: 'העסק', icon: 'briefcase' },
];

export default function VendorTabs() {
  const { vendor, loading, error, reload } = useVendor();
  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen title="לא הצלחנו לטעון">
        <Text color={colors.inkSoft}>בדקו את החיבור לאינטרנט ונסו שוב.</Text>
        <Button label="נסו שוב" onPress={reload} />
      </Screen>
    );
  }
  if (!vendor) return <Redirect href="/vendor/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line, borderTopWidth: hairline },
        tabBarLabelStyle: { fontFamily: fonts.body, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size }) => <Feather name={t.icon} size={size - 2} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
