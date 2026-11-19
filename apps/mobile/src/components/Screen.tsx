import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, shadow, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';

type Props = {
  title?: string;
  subtitle?: string;
  /** Small gold label above a large title (top-level tabs). */
  eyebrow?: string;
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

/**
 * Standard page: safe area, centered column, header.
 * Pages with `back` get a compact centered header; top-level pages get a large serif title.
 */
export function Screen({
  title,
  subtitle,
  eyebrow,
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
  const backButton = back ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="חזרה"
      hitSlop={12}
      scaleTo={0.9}
      onPress={() => (router.canGoBack() ? router.back() : backTo && router.replace(backTo))}
      style={styles.back}>
      {/* RTL: "back" points right */}
      <Feather name="chevron-right" size={22} color={colors.ink} />
    </PressableScale>
  ) : null;

  const header = back ? (
    <View style={styles.header}>
      {backButton}
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
  ) : title ? (
    <View style={styles.bigHeader}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? (
          <Text variant="eyebrow" color={colors.gold}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h1">{title}</Text>
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
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.accent} />
            ) : undefined
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
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { width: '100%', padding: space.lg, gap: space.lg, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  bigHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, marginTop: space.md },
  back: {
    width: 40,
    height: 40,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
