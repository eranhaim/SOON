/** Small shared building blocks. */
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { VENDOR_STATUS_LABELS, type ReadinessItem, type VendorStatus } from '@soon/shared';

import { colors, hairline, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Card({ children, style, tone = 'plain' }: { children: ReactNode; style?: ViewStyle; tone?: 'plain' | 'muted' }) {
  return <View style={[styles.card, tone === 'muted' && styles.cardMuted, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text variant="label" color={colors.inkSoft} style={{ letterSpacing: 2, flex: 1 }}>
        {children}
      </Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Selectable pill (categories, regions, filters). */
export function Chip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && { opacity: 0.7 }]}>
      <Text variant="bodySmall" color={selected ? colors.inverse : colors.ink}>
        {label}
        {count != null ? `  ${count}` : ''}
      </Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

const STATUS_TONE: Record<VendorStatus, { bg: string; fg: string }> = {
  draft: { bg: colors.stone, fg: colors.inkSoft },
  pending: { bg: '#EFE6D2', fg: '#6B5320' },
  approved: { bg: colors.ink, fg: colors.inverse },
  rejected: { bg: '#F1E1DF', fg: colors.danger },
  suspended: { bg: '#F1E1DF', fg: colors.danger },
};

export function StatusBadge({ status }: { status: VendorStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text variant="caption" color={tone.fg} style={{ fontSize: 12 }}>
        {VENDOR_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

/** Menu row: icon, label, optional hint, chevron. */
export function ListRow({
  icon,
  label,
  hint,
  onPress,
  disabled,
  trailing,
}: {
  icon?: IconName;
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.offWhite }, disabled && { opacity: 0.45 }]}>
      {icon ? <Feather name={icon} size={20} color={colors.ink} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="caption" color={colors.inkMuted}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? <Feather name="chevron-left" size={18} color={colors.inkMuted} />}
    </Pressable>
  );
}

export function ReadinessList({ items }: { items: ReadinessItem[] }) {
  return (
    <View style={{ gap: space.sm }}>
      {items.map((i) => (
        <View key={i.key} style={styles.readinessRow}>
          <View style={[styles.check, i.done && styles.checkDone]}>
            {i.done ? <Feather name="check" size={12} color={colors.inverse} /> : null}
          </View>
          <Text variant="bodySmall" color={i.done ? colors.inkMuted : colors.ink} style={i.done && styles.doneText}>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ComingSoon({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.soon}>
      <Feather name={icon} size={28} color={colors.inkMuted} />
      <Text variant="h2" align="center">
        {title}
      </Text>
      <Text variant="bodySmall" color={colors.inkSoft} align="center" style={{ maxWidth: 320 }}>
        {body}
      </Text>
      <Text variant="caption" color={colors.inkMuted} align="center" style={{ letterSpacing: 3, marginTop: space.sm }}>
        בקרוב
      </Text>
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  size = 18,
  tone = 'light',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  tone?: 'light' | 'dark';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        tone === 'dark' && { backgroundColor: 'rgba(17,17,17,0.72)', borderColor: 'transparent' },
        pressed && { opacity: 0.6 },
      ]}>
      <Feather name={icon} size={size} color={tone === 'dark' ? colors.inverse : colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: hairline, borderColor: colors.line, padding: space.lg, gap: space.md, backgroundColor: colors.background },
  cardMuted: { backgroundColor: colors.offWhite },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  divider: { height: hairline, backgroundColor: colors.line },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
  },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderBottomWidth: hairline,
    borderBottomColor: colors.line,
  },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.ink, borderColor: colors.ink },
  doneText: { textDecorationLine: 'line-through' },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl, minHeight: 360 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: hairline,
    borderColor: colors.line,
  },
});
