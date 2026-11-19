/**
 * The SOON logo, in one place.
 * TODO(brand): the customer is sending a new logo and font. When they arrive, add the
 * files under assets/brand/ and render them here (an <Image> or SVG) — every screen that
 * shows the logo picks it up.
 */
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  /** 'wordmark' = the name; 'symbol' = the compact mark for tight places. */
  variant?: 'wordmark' | 'symbol';
  size?: number;
  color?: string;
};

export function Logo({ variant = 'wordmark', size = 28, color = colors.ink }: Props) {
  if (variant === 'symbol') {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel="SOON"
        style={[styles.symbol, { width: size, height: size, borderColor: color }]}>
        <Text color={color} style={{ fontFamily: fonts.displayLight, fontSize: size * 0.56, lineHeight: size * 0.7 }}>
          S
        </Text>
      </View>
    );
  }
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel="SOON"
      color={color}
      style={{ fontFamily: fonts.displayLight, fontSize: size, lineHeight: size * 1.2, letterSpacing: size * 0.32, writingDirection: 'ltr' }}>
      SOON
    </Text>
  );
}

const styles = StyleSheet.create({
  symbol: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
