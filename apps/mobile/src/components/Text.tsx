import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, textStart, type as typeScale, type TypeVariant } from '@/theme/tokens';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  color?: string;
  align?: 'start' | 'center' | 'end';
};

/**
 * The only Text component screens should use. Applies the type scale and makes
 * alignment RTL-correct on both native and web.
 */
export function Text({ variant = 'body', color = colors.ink, align = 'start', style, ...rest }: TextProps) {
  const textAlign = align === 'center' ? 'center' : align === 'start' ? textStart : textStart === 'left' ? 'right' : 'left';
  return (
    <RNText
      // `lang` lets web pick Hebrew shaping/hyphenation; ignored on native.
      {...({ lang: 'he' } as object)}
      style={[typeScale[variant], { color, textAlign, writingDirection: 'rtl' }, style]}
      {...rest}
    />
  );
}
