import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { BADGE_RED } from './CountBadge';
import type { IconName } from './ui';

export type TabDef = { name: string; title: string; icon: IconName };

/**
 * Shared bottom tab navigator: white bar, soft shadow, wine active state with a top marker.
 * `badges` puts a red count on a tab (by tab name), e.g. unread messages.
 */
export function AppTabs({ tabs, badges = {} }: { tabs: TabDef[]; badges?: Record<string, number> }) {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 2 },
        tabBarItemStyle: { paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {tabs.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarBadge: badges[t.name] ? (badges[t.name]! > 99 ? '99+' : badges[t.name]) : undefined,
            tabBarBadgeStyle: styles.badge,
            tabBarIcon: ({ color, focused }) => (
              <View style={styles.iconWrap}>
                {focused ? <View style={styles.marker} /> : null}
                <Feather name={t.icon} size={21} color={color as string} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 0,
    height: 66,
    boxShadow: '0 -4px 24px rgba(60, 30, 20, 0.07)',
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center', width: 44, height: 28 },
  marker: { position: 'absolute', top: -12, width: 22, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  badge: { backgroundColor: BADGE_RED, color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 10 },
});
