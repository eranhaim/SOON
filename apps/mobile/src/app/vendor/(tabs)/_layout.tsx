import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import type { IconName } from '@/components/ui';
import { colors, fonts, hairline } from '@/theme/tokens';

/**
 * Vendor navigation (spec §2): Dashboard · Calendar · Leads · Messages · Business.
 * Loading / onboarding redirects are handled once in ../_layout.tsx (VendorGate).
 */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'ראשי', icon: 'grid' },
  { name: 'calendar', title: 'יומן', icon: 'calendar' },
  { name: 'leads', title: 'לידים', icon: 'users' },
  { name: 'messages', title: 'הודעות', icon: 'message-circle' },
  { name: 'business', title: 'העסק', icon: 'briefcase' },
];

export default function VendorTabs() {
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
