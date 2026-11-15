import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { colors, hairline, radius, shadow, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';
import type { IconName } from './ui';

type Variant = 'primary' | 'outline' | 'ghost' | 'soft' | 'light';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: IconName;
  size?: 'md' | 'sm';
  style?: ViewStyle;
};

const FG: Record<Variant, string> = {
  primary: colors.inverse,
  outline: colors.ink,
  ghost: colors.accent,
  soft: colors.accent,
  light: colors.ink,
};

export function Button({ label, variant = 'primary', loading, disabled, icon, size = 'md', style, ...rest }: Props) {
  const isDisabled = disabled || loading;
  const fg = FG[variant];
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={[styles.base, size === 'sm' && styles.sm, styles[variant], isDisabled && styles.disabled, style]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Feather name={icon} size={size === 'sm' ? 15 : 17} color={fg} /> : null}
          <Text variant="label" color={fg} align="center" style={size === 'sm' ? { fontSize: 13 } : undefined}>
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 40, paddingHorizontal: space.md },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primary: { backgroundColor: colors.accent, ...shadow.accent },
  outline: { backgroundColor: colors.surface, borderWidth: hairline, borderColor: colors.stoneDeep },
  ghost: { backgroundColor: 'transparent' },
  soft: { backgroundColor: colors.accentSoft },
  light: { backgroundColor: colors.surface, ...shadow.md },
  disabled: { opacity: 0.4, boxShadow: 'none' },
});
