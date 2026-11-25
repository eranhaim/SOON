import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { UserRole } from '@soon/shared';

import { Button } from '@/components/Button';
import { LangSwitch } from '@/components/LangSwitch';
import { Logo } from '@/components/Logo';
import { PressableScale, Reveal } from '@/components/motion';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { signInDemo } from '@/lib/demo';
import { atEnd, colors, fonts, photo, space } from '@/theme/tokens';

type Side = Extract<UserRole, 'couple' | 'vendor'>;

/**
 * Exactly two paths (spec §1): couple or vendor. Two full-bleed photo panels; tapping one
 * opens the welcome sheet with the sign-in options.
 */
const PANELS: { side: Side; n: string; title: string; subtitle: string; image: string; label: string }[] = [
  {
    side: 'couple',
    n: '01',
    title: 'אני כלה / זוג',
    subtitle: 'כל החתונה שלי במקום אחד',
    image: photo('1519741497674-611481863552', 1400),
    label: 'כלה / זוג',
  },
  {
    side: 'vendor',
    n: '02',
    title: 'אני ספק',
    subtitle: 'העסק שלי מול זוגות במקום אחד',
    image: photo('1519225421980-715cb0215aed', 1400),
    label: 'ספק',
  },
];

export default function ChooseRole() {
  const insets = useSafeAreaInsets();
  const [side, setSide] = useState<Side | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const panel = PANELS.find((p) => p.side === side);

  async function demo(provider: string) {
    if (!side) return;
    setError(undefined);
    setBusy(provider);
    try {
      await signInDemo(side);
      setSide(null);
    } catch {
      setError('ההתחברות נכשלה. נסו שוב.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      {PANELS.map((p, i) => (
        <PressableScale
          key={p.side}
          scaleTo={0.985}
          accessibilityRole="button"
          accessibilityLabel={p.title}
          onPress={() => setSide(p.side)}
          style={styles.panel}>
          <Image source={p.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={600} />
          <LinearGradient
            colors={['rgba(36,18,15,0.05)', 'rgba(36,18,15,0.15)', 'rgba(36,18,15,0.78)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Reveal index={i + 1} style={styles.panelText}>
            <Text variant="eyebrow" color="rgba(255,255,255,0.75)">
              {p.n}
            </Text>
            <Text color={colors.inverse} style={styles.panelTitle}>
              {p.title}
            </Text>
            <View style={styles.panelSub}>
              <Text variant="bodySmall" color="rgba(255,255,255,0.86)">
                {p.subtitle}
              </Text>
              <Feather name="arrow-left" size={16} color={colors.inverse} />
            </View>
          </Reveal>
        </PressableScale>
      ))}

      {/* Logo over the seam of the top panel */}
      <View pointerEvents="none" style={[styles.logoWrap, { top: insets.top + space.md }]}>
        <Logo size={26} color={colors.inverse} />
      </View>
      <View style={[styles.lang, { top: insets.top + space.md + 6 }, atEnd(space.lg)]}>
        <LangSwitch tone="light" />
      </View>

      <Sheet visible={!!side} onClose={() => setSide(null)} eyebrow={panel?.label} title="ברוכים הבאים">
        <Text variant="bodySmall" color={colors.inkSoft} style={{ marginTop: -space.sm }}>
          זו גרסת דמו: הכניסה עם Apple או Google פותחת חשבון לדוגמה.
        </Text>
        <Button label="המשך עם Apple" icon="smartphone" loading={busy === 'apple'} onPress={() => demo('apple')} style={styles.apple} />
        <Button label="המשך עם Google" variant="outline" icon="globe" loading={busy === 'google'} onPress={() => demo('google')} />
        <View style={styles.or}>
          <View style={styles.orRule} />
          <Text variant="caption" color={colors.inkMuted}>
            או
          </Text>
          <View style={styles.orRule} />
        </View>
        <Button
          label="המשך עם אימייל"
          variant="soft"
          icon="mail"
          onPress={() => {
            const role = side;
            setSide(null);
            router.push({ pathname: '/sign-in', params: { role: role ?? undefined } });
          }}
        />
        {error ? (
          <Text variant="caption" color={colors.danger} align="center">
            {error}
          </Text>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, gap: 2 },
  panel: { flex: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  panelText: { padding: space.lg, paddingBottom: space.xl, gap: 4 },
  panelTitle: { fontFamily: fonts.display, fontSize: 38, lineHeight: 46 },
  panelSub: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  logoWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  lang: { position: 'absolute' },
  apple: { backgroundColor: colors.night, boxShadow: 'none' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  orRule: { flex: 1, height: 1, backgroundColor: colors.line },
});
