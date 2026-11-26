import Feather from '@expo/vector-icons/Feather';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFlag, setFlag } from '@/lib/flags';
import { guideFor, type Guide } from '@/lib/guides';
import { useSessionUser } from '@/lib/session';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

type Memory = { off: boolean; seen: string[] };
const keyOf = (userId: string) => `soon.guides.${userId}`;

async function load(userId: string): Promise<Memory> {
  try {
    const raw = await getFlag(keyOf(userId));
    const m = raw ? (JSON.parse(raw) as Partial<Memory>) : {};
    return { off: Boolean(m.off), seen: Array.isArray(m.seen) ? m.seen : [] };
  } catch {
    return { off: false, seen: [] };
  }
}

/** Show the guides again (from the profile / settings). */
export async function resetGuides(userId: string) {
  await setFlag(keyOf(userId), JSON.stringify({ off: false, seen: [] }));
}

/**
 * First-visit guide for the current screen (see lib/guides). Mounted once in the root layout;
 * shows a bottom card with 1–3 steps. "דילוג" skips this screen, "בלי הדרכות" turns all off.
 */
export function GuideHost() {
  const path = usePathname();
  const { user, role } = useSessionUser();
  const insets = useSafeAreaInsets();
  // The guide is tied to the screen it opened on, so it never shows on another screen.
  const [shown, setShown] = useState<{ path: string; guide: Guide } | null>(null);
  const [step, setStep] = useState(0);
  const guide = shown && shown.path === path ? shown.guide : null;

  useEffect(() => {
    const g = user ? guideFor(path, role) : null;
    if (!g || !user) return;
    let alive = true;
    // Let the screen appear first.
    const t = setTimeout(async () => {
      const m = await load(user.id);
      if (alive && !m.off && !m.seen.includes(g.key)) {
        setStep(0);
        setShown({ path, guide: g });
      }
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [path, role, user]);

  async function finish(allOff = false) {
    const g = guide;
    setShown(null);
    if (!g || !user) return;
    const m = await load(user.id);
    await setFlag(keyOf(user.id), JSON.stringify({ off: m.off || allOff, seen: [...new Set([...m.seen, g.key])] }));
  }

  if (!guide) return null;
  const s = guide.steps[step]!;
  const last = step === guide.steps.length - 1;

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => finish()} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => finish()} accessibilityLabel="דילוג על ההדרכה" />
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(180)} style={[styles.card, { paddingBottom: space.lg + insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.top}>
            <Text variant="eyebrow" color={colors.gold}>
              {guide.steps.length > 1 ? `מדריך קצר · ${step + 1} מתוך ${guide.steps.length}` : 'מדריך קצר'}
            </Text>
            <Pressable onPress={() => finish()} hitSlop={10} accessibilityRole="button" accessibilityLabel="דילוג">
              <Text variant="label" color={colors.inkMuted}>
                דילוג
              </Text>
            </Pressable>
          </View>
          <Animated.View key={step} entering={FadeInDown.duration(260)} style={styles.body}>
            <View style={styles.icon}>
              <Feather name={s.icon} size={24} color={colors.accent} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{s.title}</Text>
              <Text variant="body" color={colors.inkSoft}>
                {s.body}
              </Text>
            </View>
          </Animated.View>
          <View style={styles.footer}>
            <View style={styles.dots}>
              {guide.steps.length > 1 ? guide.steps.map((_, n) => <View key={n} style={[styles.dot, n === step && styles.dotOn]} />) : null}
            </View>
            {step > 0 ? <Button variant="ghost" size="sm" label="הקודם" onPress={() => setStep(step - 1)} /> : null}
            <Button size="sm" label={last ? 'הבנתי' : 'הבא'} onPress={() => (last ? finish() : setStep(step + 1))} style={{ minWidth: 110 }} />
          </View>
          <Pressable onPress={() => finish(true)} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
            <Text variant="caption" color={colors.inkMuted} style={{ textDecorationLine: 'underline' }}>
              לא להציג יותר הדרכות
            </Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(36, 18, 15, 0.38)' },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    gap: space.md,
    paddingTop: space.sm,
    paddingHorizontal: space.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    ...shadow.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.stoneDeep },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, minHeight: 96 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  title: { fontFamily: fonts.displayMedium, fontSize: 21, lineHeight: 28, color: colors.ink },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dots: { flex: 1, flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.stone },
  dotOn: { width: 20, backgroundColor: colors.accent },
});
