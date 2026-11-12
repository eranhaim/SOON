import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { colors, hairline, radius, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: 'primary' | 'outline' | 'ghost';
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, variant = 'primary', loading, disabled, style, ...rest }: Props) {
  const isDisabled = disabled || loading;
  const fg = variant === 'primary' ? colors.inverse : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant="label" color={fg} align="center">
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.ink },
  outline: { backgroundColor: 'transparent', borderWidth: hairline, borderColor: colors.ink },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
});
