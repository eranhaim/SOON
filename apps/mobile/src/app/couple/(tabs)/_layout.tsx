import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import type { IconName } from '@/components/ui';
import { colors, fonts, hairline } from '@/theme/tokens';

/** Couple navigation (spec §2): Home · Explore · Saved · Planning · Profile. */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'בית', icon: 'home' },
  { name: 'explore', title: 'גילוי', icon: 'search' },
  { name: 'saved', title: 'שמורים', icon: 'heart' },
  { name: 'planning', title: 'תכנון', icon: 'check-square' },
  { name: 'profile', title: 'פרופיל', icon: 'user' },
];

export default function CoupleTabs() {
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
