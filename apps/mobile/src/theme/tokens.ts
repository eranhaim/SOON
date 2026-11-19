/**
 * SOON design tokens — black and white only. White, clean backgrounds; soft off-whites
 * for depth; black text and actions; square corners; very few frames.
 * (Legacy names like `accent` / `gold` are kept so screens need no renames: they now
 * resolve to black and greys.)
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  /** Raised surfaces (cards, sheets, inputs). */
  surface: '#FFFFFF',
  /** Soft off-white for depth and grouped areas. */
  offWhite: '#F6F6F4',
  stone: '#ECECEA',
  stoneDeep: '#BDBDBA',
  line: '#E6E6E4',
  ink: '#0B0B0B',
  inkSoft: '#555553',
  inkMuted: '#8F8F8C',
  inverse: '#FFFFFF',
  /** Black for dramatic surfaces (intro, hero cards). */
  night: '#0B0B0B',
  /** Actions and selected states: black. */
  accent: '#0B0B0B',
  accentDeep: '#000000',
  accentSoft: '#F2F2F0',
  /** Secondary labels and small details: greys (no colour). */
  gold: '#6E6E6B',
  goldLight: '#D6D6D3',
  goldSoft: '#F2F2F0',
  success: '#0B0B0B',
  successSoft: '#F2F2F0',
  /** Errors only. */
  danger: '#8A2A2A',
  dangerSoft: '#F6ECEC',
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

/** Square by default. `round` is for things that are circles by nature (avatars, dots). */
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  xl: 0,
  pill: 0,
  round: 999,
} as const;

export const hairline = 1;

/** Soft, warm shadows (boxShadow works on web and on native with the new architecture). */
/** Barely-there depth; separation comes from spacing and off-white areas, not frames. */
export const shadow = {
  sm: { boxShadow: '0 1px 0 rgba(0, 0, 0, 0.04)' },
  md: { boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.05)' },
  lg: { boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)' },
  accent: { boxShadow: 'none' },
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

/**
 * Curated photography for decorative surfaces.
 * TODO(brand): replace with the customer's own photos when they arrive.
 */
export const photo = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;
export const PHOTOS = {
  heroCouple: photo('1519741497674-611481863552'),
  heroTable: photo('1519225421980-715cb0215aed'),
  heroRings: photo('1515934751635-c81c6bc9a2d8'),
  heroFlowers: photo('1525258946800-98cfd641d0de'),
} as const;
