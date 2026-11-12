import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { UserRole } from '@soon/shared';

import { Text } from '@/components/Text';
import { colors, hairline, space } from '@/theme/tokens';

/**
 * Exactly two paths (spec §1): couple or vendor. Producers sign up as vendors and pick the
 * "הפקת אירועים" category later — there is no third path.
 */
const OPTIONS: { role: Extract<UserRole, 'couple' | 'vendor'>; title: string; subtitle: string }[] = [
  { role: 'couple', title: 'אנחנו מתחתנים', subtitle: 'מחפשים ספקים, השראה וכלים לתכנון החתונה' },
  { role: 'vendor', title: 'אני ספק / מפיקה', subtitle: 'פרופיל עסקי, לידים, יומן וניהול לקוחות' },
];

export default function ChooseRole() {
  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" color={colors.inkMuted} style={styles.eyebrow}>
          SOON
        </Text>
        <Text variant="h1">ברוכים הבאים</Text>
        <Text variant="body" color={colors.inkSoft} style={styles.lead}>
          איך תרצו להשתמש ב־SOON?
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.role}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/sign-in', params: { role: o.role } })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <Text variant="h2">{o.title}</Text>
              <Text variant="bodySmall" color={colors.inkSoft}>
                {o.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingTop: space.xxxl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
  eyebrow: { letterSpacing: 4 },
  lead: { marginBottom: space.xl },
  options: { gap: space.md },
  card: {
    gap: space.xs,
    padding: space.lg,
    borderWidth: hairline,
    borderColor: colors.line,
    backgroundColor: colors.offWhite,
  },
  cardPressed: { borderColor: colors.ink },
});
