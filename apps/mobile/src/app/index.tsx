import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { homeForRole, useSessionUser } from '@/lib/session';
import { colors, fonts } from '@/theme/tokens';

/**
 * Opening screen (spec §2): the logo fades in, then the app continues on its own
 * (or on tap) to the user's home, or to the role choice when signed out.
 * TODO: replace the dark backdrop with the short cinematic couple video (expo-video).
 */
export default function Intro() {
  const { session, role, isPending } = useSessionUser();

  useEffect(() => {
    if (isPending) return;
    const t = setTimeout(next, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending]);

  function next() {
    router.replace(session && role ? homeForRole(role) : '/choose-role');
  }

  return (
    <Pressable style={styles.root} onPress={next} disabled={isPending} accessibilityRole="button" accessibilityLabel="המשך">
      <Animated.View entering={FadeIn.duration(1400)} style={{ alignItems: 'center', gap: 14 }}>
        <Text align="center" color={colors.inverse} style={styles.logo}>
          SOON
        </Text>
        <View style={styles.rule} />
      </Animated.View>
      <Animated.View entering={FadeInUp.delay(600).duration(900)}>
        <Text variant="eyebrow" align="center" color={colors.goldLight} style={{ marginTop: 18 }}>
          החתונה שלכם, במקום אחד
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.displayLight, fontSize: 56, lineHeight: 64, letterSpacing: 16, writingDirection: 'ltr' },
  rule: { width: 48, height: 1, backgroundColor: colors.goldLight },
});
