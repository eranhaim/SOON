import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import type { IconName } from './ui';

export type TabDef = { name: string; title: string; icon: IconName };

/** Shared bottom tab navigator: white bar, soft shadow, wine active state with a top marker. */
export function AppTabs({ tabs }: { tabs: TabDef[] }) {
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
});
