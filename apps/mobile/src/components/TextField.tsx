import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, hairline, radius, space, textStart } from '@/theme/tokens';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string;
  /** For left-to-right content such as emails, phone numbers and codes. */
  ltr?: boolean;
};

/** Soft filled input with a floating-style label above and an accent focus ring. */
export function TextField({ label, error, ltr, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={focused ? colors.accent : colors.inkSoft} style={styles.label}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          { textAlign: ltr ? 'left' : textStart, writingDirection: ltr ? 'ltr' : 'rtl' },
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          // Remove the browser focus outline; the border shows focus instead.
          { outlineStyle: 'none' } as object,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, paddingHorizontal: 4 },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.line,
    borderRadius: radius.md,
  },
  inputFocused: { borderColor: colors.accent, boxShadow: '0 0 0 3px rgba(110, 30, 58, 0.10)' },
  inputError: { borderColor: colors.danger },
});
