/** Small shared building blocks. */
import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { VENDOR_STATUS_LABELS, type ReadinessItem, type VendorStatus } from '@soon/shared';

import { colors, hairline, radius, shadow, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';

export type IconName = ComponentProps<typeof Feather>['name'];

export function Card({
  children,
  style,
  tone = 'plain',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'plain' | 'muted' | 'accent';
}) {
  return (
    <View style={[styles.card, tone === 'muted' && styles.cardMuted, tone === 'accent' && styles.cardAccent, style]}>
      {children}
    </View>
  );
}

/** Serif section heading with an optional eyebrow and action (e.g. "see all"). */
export function SectionTitle({ children, action, eyebrow }: { children: string; action?: ReactNode; eyebrow?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={{ flex: 1, gap: 2 }}>
        {eyebrow ? (
          <Text variant="eyebrow" color={colors.gold}>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="h2" style={{ fontSize: 21 }}>
          {children}
        </Text>
      </View>
      {action}
    </View>
  );
}

/** Thin divider. `ornament` adds a small gold diamond in the middle. */
export function Divider({ ornament }: { ornament?: boolean }) {
  if (!ornament) return <View style={styles.divider} />;
  return (
    <View style={styles.ornamentRow}>
      <View style={[styles.divider, { flex: 1 }]} />
      <View style={styles.diamond} />
      <View style={[styles.divider, { flex: 1 }]} />
    </View>
  );
}

/** Round icon badge in a soft tint. */
export function IconBadge({
  icon,
  tone = 'gold',
  size = 40,
}: {
  icon: IconName;
  tone?: 'gold' | 'accent' | 'light';
  size?: number;
}) {
  const bg = tone === 'gold' ? colors.goldSoft : tone === 'accent' ? colors.accentSoft : 'rgba(255,255,255,0.16)';
  const fg = tone === 'gold' ? colors.gold : tone === 'accent' ? colors.accent : colors.inverse;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={Math.round(size * 0.45)} color={fg} />
    </View>
  );
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
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      scaleTo={0.94}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text variant="bodySmall" color={selected ? colors.inverse : colors.ink} style={selected ? { fontFamily: 'Heebo_500Medium' } : undefined}>
        {label}
        {count != null ? `  ${count}` : ''}
      </Text>
    </PressableScale>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

const STATUS_TONE: Record<VendorStatus, { bg: string; fg: string }> = {
  draft: { bg: colors.stone, fg: colors.inkSoft },
  pending: { bg: colors.goldSoft, fg: '#7A5A22' },
  approved: { bg: colors.successSoft, fg: colors.success },
  rejected: { bg: colors.dangerSoft, fg: colors.danger },
  suspended: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusBadge({ status }: { status: VendorStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone.fg }]} />
      <Text variant="caption" color={tone.fg} style={{ fontFamily: 'Heebo_500Medium' }}>
        {VENDOR_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

/** Menu row: icon badge, label, optional hint, chevron. */
export function ListRow({
  icon,
  leading,
  label,
  hint,
  onPress,
  disabled,
  trailing,
}: {
  icon?: IconName;
  /** Replaces the icon badge (for example a brand mark). */
  leading?: ReactNode;
  label: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {leading ?? (icon ? <IconBadge icon={icon} size={38} /> : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" style={{ fontFamily: 'Heebo_500Medium' }}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color={colors.inkMuted}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Feather name="chevron-left" size={18} color={colors.stoneDeep} /> : null)}
    </>
  );
  // A row without its own action is a plain view, so it can hold its own buttons (no nested <button> on web).
  if (!onPress) return <View style={[styles.row, disabled && { opacity: 0.45 }]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.offWhite }, disabled && { opacity: 0.45 }]}>
      {content}
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
      <View style={styles.soonHalo}>
        <IconBadge icon={icon} size={64} />
      </View>
      <Text variant="h1" align="center">
        {title}
      </Text>
      <Text variant="body" color={colors.inkSoft} align="center" style={{ maxWidth: 320 }}>
        {body}
      </Text>
      <View style={styles.soonPill}>
        <Text variant="eyebrow" color={colors.gold}>
          בקרוב
        </Text>
      </View>
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
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      scaleTo={0.9}
      style={[styles.iconBtn, tone === 'dark' && styles.iconBtnDark]}>
      <Feather name={icon} size={size} color={tone === 'dark' ? colors.inverse : colors.ink} />
    </PressableScale>
  );
}

/** Empty state with an icon, title, text and optional action. */
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconBadge icon={icon} size={56} />
      <Text variant="h2" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="bodySmall" color={colors.inkSoft} align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: 'rgba(205, 187, 160, 0.35)',
    ...shadow.sm,
  },
  cardMuted: { backgroundColor: colors.offWhite, borderColor: 'transparent', boxShadow: 'none' },
  cardAccent: { backgroundColor: colors.accentSoft, borderColor: 'transparent', boxShadow: 'none' },
  sectionTitle: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  divider: { height: hairline, backgroundColor: colors.line },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  diamond: { width: 7, height: 7, backgroundColor: colors.goldLight, transform: [{ rotate: '45deg' }] },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 9,
    borderWidth: hairline,
    borderColor: colors.line,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent, ...shadow.accent },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.xs,
    borderBottomWidth: hairline,
    borderBottomColor: colors.line,
    borderRadius: radius.sm,
  },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.stoneDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success, borderColor: colors.success },
  doneText: { textDecorationLine: 'line-through' },
  soon: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl, minHeight: 420 },
  soonHalo: { padding: 14, borderRadius: 999, backgroundColor: 'rgba(243, 233, 215, 0.5)', marginBottom: space.sm },
  soonPill: {
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: hairline,
    borderColor: colors.goldLight,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  iconBtnDark: { backgroundColor: 'rgba(36, 18, 15, 0.55)', boxShadow: 'none' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.lg },
});
