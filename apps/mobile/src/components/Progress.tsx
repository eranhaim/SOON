import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

/** Thin animated progress bar (0..1). */
export function ProgressBar({
  value,
  color = colors.accent,
  track = colors.stone,
  height = 4,
  delay = 150,
  style,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  delay?: number;
  style?: ViewStyle;
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withDelay(delay, withTiming(v, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [v, delay, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height, backgroundColor: track }, style]}>
      <Animated.View style={[styles.fill, { borderRadius: height, backgroundColor: color }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
