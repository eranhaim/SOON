import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { homeForRole, useSessionUser } from '@/lib/session';
import { colors, fonts } from '@/theme/tokens';

/**
 * Opening screen (spec §2): logo centered, no buttons or extra text; tap to continue.
 * TODO: replace the dark backdrop with the short cinematic couple video (expo-video)
 * once the footage exists.
 */
export default function Intro() {
  const { session, role, isPending } = useSessionUser();
  const opacity = useSharedValue(0);
  const fadeIn = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    opacity.set(withTiming(1, { duration: 1400 }));
  }, [opacity]);

  function next() {
    router.replace(session && role ? homeForRole(role) : '/choose-role');
  }

  return (
    <Pressable
      style={styles.root}
      onPress={next}
      disabled={isPending}
      accessibilityRole="button"
      accessibilityLabel="המשך">
      <Animated.View style={fadeIn}>
        <Text align="center" color={colors.inverse} style={styles.logo}>
          SOON
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.display, fontSize: 56, lineHeight: 64, letterSpacing: 14, writingDirection: 'ltr' },
});
