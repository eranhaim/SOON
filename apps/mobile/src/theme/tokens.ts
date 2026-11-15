/**
 * SOON design tokens — "Warm luxury": ivory and champagne surfaces, deep wine accent,
 * soft gold details, editorial serif headings. Think premium wedding magazine.
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  /** Page background: warm ivory. */
  background: '#FBF7F1',
  /** Raised surfaces (cards, sheets, inputs). */
  surface: '#FFFFFF',
  /** Tinted surface: champagne. */
  offWhite: '#F4ECE1',
  stone: '#EBE0D0',
  stoneDeep: '#CDBBA0',
  line: '#ECE2D4',
  ink: '#2B1E1C',
  inkSoft: '#6E5F58',
  inkMuted: '#A3938B',
  inverse: '#FFFFFF',
  /** Deep wine-black for dramatic surfaces (hero, intro). */
  night: '#24120F',
  /** Brand accent: deep wine. Primary buttons, selected states, links. */
  accent: '#6E1E3A',
  accentDeep: '#4E1229',
  accentSoft: '#F5E6EA',
  /** Soft gold details: dividers, icons, eyebrows, stars. */
  gold: '#B48A4E',
  goldLight: '#D9BE8C',
  goldSoft: '#F3E9D7',
  success: '#3F6B4E',
  successSoft: '#E5EFE7',
  danger: '#9B2C2C',
  dangerSoft: '#F6E3E1',
} as const;

export const fonts = {
  /** Editorial serif for display text and headings. */
  displayLight: 'FrankRuhlLibre_300Light',
  display: 'FrankRuhlLibre_400Regular',
  displayMedium: 'FrankRuhlLibre_500Medium',
  displayBold: 'FrankRuhlLibre_700Bold',
  /** Clean sans for UI and body text. */
  bodyLight: 'Heebo_300Light',
  body: 'Heebo_400Regular',
  bodyMedium: 'Heebo_500Medium',
  bodyBold: 'Heebo_700Bold',
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
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const hairline = 1;

/** Soft, warm shadows (boxShadow works on web and on native with the new architecture). */
export const shadow = {
  sm: { boxShadow: '0 1px 2px rgba(60, 30, 20, 0.06), 0 2px 8px rgba(60, 30, 20, 0.05)' },
  md: { boxShadow: '0 2px 6px rgba(60, 30, 20, 0.06), 0 10px 28px rgba(60, 30, 20, 0.09)' },
  lg: { boxShadow: '0 6px 16px rgba(60, 30, 20, 0.10), 0 24px 56px rgba(60, 30, 20, 0.16)' },
  accent: { boxShadow: '0 6px 18px rgba(110, 30, 58, 0.28)' },
} as const satisfies Record<string, ViewStyle>;

/**
 * Start-aligned text for an RTL app. On native, forcesRTL flips 'left' to mean "start";
 * on web, 'left' is literal, so we use 'right'.
 */
export const textStart: TextStyle['textAlign'] = Platform.OS === 'web' ? 'right' : 'left';

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 42, lineHeight: 50, letterSpacing: 0.3 },
  h1: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  h2: { fontFamily: fonts.displayMedium, fontSize: 22, lineHeight: 30 },
  h3: { fontFamily: fonts.bodyMedium, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 },
  eyebrow: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 16, letterSpacing: 2.5 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
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

/** Curated photography (Unsplash) for decorative surfaces. */
export const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;
export const PHOTOS = {
  heroCouple: photo('1519741497674-611481863552'),
  heroTable: photo('1519225421980-715cb0215aed'),
  heroRings: photo('1515934751635-c81c6bc9a2d8'),
  heroFlowers: photo('1525258946800-98cfd641d0de'),
} as const;
