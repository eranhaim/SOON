/**
 * SOON design tokens — Minimal / Timeless / Luxury / Editorial (spec §2).
 * White, black, off-white, grey and stone only. No pink, no playful colors.
 */
import { Platform, type TextStyle } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  offWhite: '#F8F6F2',
  stone: '#E9E4DC',
  stoneDeep: '#BFB7AA',
  line: '#E6E1D9',
  ink: '#111111',
  inkSoft: '#57534E',
  inkMuted: '#8C867E',
  inverse: '#FFFFFF',
  night: '#0E0E0E',
  danger: '#8E2F2F',
} as const;

export const fonts = {
  /** Editorial serif for display text and headings. */
  display: 'FrankRuhlLibre_400Regular',
  displayMedium: 'FrankRuhlLibre_500Medium',
  /** Clean sans for UI and body text. */
  bodyLight: 'Heebo_300Light',
  body: 'Heebo_400Regular',
  bodyMedium: 'Heebo_500Medium',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 72,
} as const;

export const radius = {
  sm: 2,
  md: 4,
  pill: 999,
} as const;

export const hairline = 1;

/**
 * Start-aligned text for an RTL app. On native, forcesRTL flips 'left' to mean "start";
 * on web, 'left' is literal, so we use 'right'.
 */
export const textStart: TextStyle['textAlign'] = Platform.OS === 'web' ? 'right' : 'left';

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, letterSpacing: 0.5 },
  h1: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  h2: { fontFamily: fonts.displayMedium, fontSize: 22, lineHeight: 30 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, letterSpacing: 1 },
  caption: { fontFamily: fonts.bodyLight, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/**
 * Logical "start"/"end" for absolutely positioned elements and borders.
 * Native (forcesRTL) flips start/end itself; react-native-web maps them as LTR even
 * under <html dir="rtl">, so on web we use the physical side: start = right.
 */
const isWeb = Platform.OS === 'web';
export const atStart = (n: number) => (isWeb ? { right: n } : { start: n });
export const atEnd = (n: number) => (isWeb ? { left: n } : { end: n });
export const borderAtStart = (width: number, color: string) =>
  isWeb ? { borderRightWidth: width, borderRightColor: color } : { borderStartWidth: width, borderStartColor: color };
export const padAtStart = (n: number) => (isWeb ? { paddingRight: n } : { paddingStart: n });
