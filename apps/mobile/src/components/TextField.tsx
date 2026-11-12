import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, hairline, space, textStart } from '@/theme/tokens';

import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string;
  /** For left-to-right content such as emails, phone numbers and codes. */
  ltr?: boolean;
};

/** Underlined editorial input. */
export function TextField({ label, error, ltr, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[
          styles.input,
          { textAlign: ltr ? 'left' : textStart, writingDirection: ltr ? 'ltr' : 'rtl' },
          error ? styles.inputError : null,
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
  wrap: { gap: space.xs },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
    paddingVertical: space.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.stoneDeep,
  },
  inputError: { borderBottomColor: colors.danger },
});
