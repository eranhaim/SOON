import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { getFlag, setFlag } from '@/lib/flags';
import { useSessionUser } from '@/lib/session';
import { colors, radius, shadow, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';
import type { IconName } from './ui';

type Step = { icon: IconName; title: string; body: string };

const COUPLE_STEPS: Step[] = [
  { icon: 'heart', title: 'ברוכים הבאים ל־SOON', body: 'כל התכנון של החתונה במקום אחד: ספקים, תקציב, מוזמנים, משימות והזמנה.' },
  { icon: 'search', title: 'מוצאים ספקים', body: 'חפשו לפי תחום, אזור ותאריך. ראו מחירים, ביקורות וזמינות בתאריך שלכם.' },
  { icon: 'phone-call', title: 'פונים בקלות', body: 'שלחו הודעה, בקשו הצעת מחיר או קבעו שיחת התאמה, ישירות מעמוד הספק.' },
  { icon: 'grid', title: 'מתכננים יחד', body: 'תקציב, צ׳קליסט, רשימת מוזמנים ויומן. הזמינו את בן/בת הזוג מהפרופיל ותכננו יחד.' },
  { icon: 'globe', title: 'אתר חתונה', body: 'הזמנה מעוצבת עם אישורי הגעה, ניווט, ברכות ומתנות. ויש גם יועצת AI לכל שאלה.' },
];

const VENDOR_STEPS: Step[] = [
  { icon: 'briefcase', title: 'ברוכים הבאים ל־SOON', body: 'כאן זוגות מוצאים אתכם, ואתם מנהלים את העסק: פניות, לקוחות, יומן וכספים.' },
  { icon: 'user', title: 'עמוד העסק', body: 'ערכו את העמוד ישירות: תמונות, סרטונים, חבילות ושאלות נפוצות. שתפו את הקישור באינסטגרם.' },
  { icon: 'users', title: 'לקוחות ויומן', body: 'כל פנייה נכנסת ללקוחות. קבעו אירועים ופגישות ביומן, והגדירו שעות לשיחות התאמה.' },
  { icon: 'trending-up', title: 'נתונים וכספים', body: 'צפיות, פניות ועסקאות, הכנסות, הוצאות ומסמכים ללקוחות, הכל במקום אחד.' },
];

/** First visit only (per user, per device): a short tour with "skip". */
export function WelcomeTour({ side }: { side: 'couple' | 'vendor' }) {
  const { user } = useSessionUser();
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const key = user ? `soon.tour.${side}.${user.id}` : null;
  const steps = side === 'couple' ? COUPLE_STEPS : VENDOR_STEPS;

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void getFlag(key).then((v) => alive && !v && setVisible(true));
    return () => {
      alive = false;
    };
  }, [key]);

  const close = () => {
    setVisible(false);
    if (key) void setFlag(key, '1');
  };
  if (!visible) return null;
  const s = steps[i]!;
  const last = i === steps.length - 1;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.card}>
          <Animated.View key={i} entering={FadeIn.duration(260)} style={{ alignItems: 'center', gap: space.md }}>
            <View style={styles.icon}>
              <Feather name={s.icon} size={28} color={colors.accent} />
            </View>
            <Text variant="h2" align="center">
              {s.title}
            </Text>
            <Text variant="body" color={colors.inkSoft} align="center">
              {s.body}
            </Text>
          </Animated.View>
          <View style={styles.dots}>
            {steps.map((_, n) => (
              <View key={n} style={[styles.dot, n === i && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.actions}>
            {!last ? <Button variant="ghost" label="דילוג" onPress={close} style={{ flex: 1 }} /> : null}
            <Button label={last ? 'מתחילים' : 'הבא'} onPress={() => (last ? close() : setI(i + 1))} style={{ flex: 2 }} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(36, 18, 15, 0.55)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 420, gap: space.lg, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.background, ...shadow.lg },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.stone },
  dotOn: { width: 20, backgroundColor: colors.accent },
  actions: { flexDirection: 'row', gap: space.md },
});

