import { router } from 'expo-router';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LangSwitch } from '@/components/LangSwitch';
import { Logo } from '@/components/Logo';
import { PressableScale } from '@/components/motion';
import { Text } from '@/components/Text';
import { homeForRole, useSessionUser } from '@/lib/session';
import { atEnd, colors, space } from '@/theme/tokens';

/**
 * TODO(brand): the customer's opening video. Put the file at assets/brand/intro.mp4 and set:
 *   const INTRO_VIDEO: VideoSource = require('../../assets/brand/intro.mp4');
 */
const INTRO_VIDEO: VideoSource | null = null;

/**
 * Opening screen (spec §2): video in the background, the logo in the centre, a quiet
 * "tap to continue", and the language switch in the top-left corner.
 */
export default function Intro() {
  const insets = useSafeAreaInsets();
  const { session, role, isPending } = useSessionUser();

  function next() {
    if (isPending) return;
    router.replace(session && role ? homeForRole(role) : '/choose-role');
  }

  return (
    <View style={styles.root}>
      {INTRO_VIDEO ? <IntroVideo source={INTRO_VIDEO} /> : null}
      <PressableScale style={styles.tap} onPress={next} accessibilityRole="button" accessibilityLabel="לחצו להמשך">
        <Animated.View entering={FadeIn.duration(1200)}>
          <Logo size={44} color={colors.inverse} />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(900).duration(900)} style={[styles.hint, { bottom: insets.bottom + space.xl }]}>
          <Text variant="caption" color="rgba(255,255,255,0.7)" align="center" style={{ letterSpacing: 2 }}>
            לחצו להמשך
          </Text>
        </Animated.View>
      </PressableScale>
      <View style={[styles.lang, { top: insets.top + space.md }, atEnd(space.lg)]}>
        <LangSwitch tone="light" />
      </View>
    </View>
  );
}

function IntroVideo({ source }: { source: VideoSource }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night },
  tap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', left: 0, right: 0 },
  lang: { position: 'absolute' },
});
