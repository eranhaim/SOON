import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  /** Show a back button (goes back, or to `backTo` when there's no history). */
  back?: boolean;
  backTo?: Parameters<typeof router.replace>[0];
  right?: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'bottom')[];
};

/** Standard page: safe area, centered column, optional header with back button. */
export function Screen({
  title,
  subtitle,
  back,
  backTo,
  right,
  children,
  maxWidth = 720,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  edges = ['top'],
}: Props) {
  const header =
    title || back ? (
      <View style={styles.header}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            hitSlop={12}
            onPress={() => (router.canGoBack() ? router.back() : backTo && router.replace(backTo))}
            style={styles.back}>
            {/* RTL: "back" points right */}
            <Feather name="chevron-right" size={24} color={colors.ink} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          {title ? <Text variant="h2">{title}</Text> : null}
          {subtitle ? (
            <Text variant="bodySmall" color={colors.inkSoft}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;

  const inner = [styles.content, { maxWidth }, contentStyle];

  return (
    <SafeAreaView style={styles.root} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined
          }>
          <View style={inner}>
            {header}
            {children}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>
          <View style={[inner, { flex: 1 }]}>
            {header}
            {children}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  back: { padding: space.xs, marginStart: -space.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
