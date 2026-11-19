/**
 * Interaction kit. The design language asks for calm, minimal motion: no moving text,
 * no count-ups. Presses get a soft opacity response; screen changes use a plain fade
 * (set in the navigators). `Reveal` and `useCountUp` stay as no-ops so screens keep one API.
 */
import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Kept for API compatibility; presses no longer scale. */
  scaleTo?: number;
  children: ReactNode;
};

/** Pressable with a quiet press state (slight fade). */
export function PressableScale({ style, scaleTo: _scaleTo, children, ...rest }: PressableScaleProps) {
  return (
    <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}>
      {children}
    </Pressable>
  );
}

/** Plain container (entrance animations are intentionally off). */
export function Reveal({
  children,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

/** Returns the value as-is (numbers don't animate). */
export function useCountUp(target: number, _duration?: number) {
  return target;
}
