import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, ListRow, StatusBadge } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { resetDemo, signInDemo, signOutToStart } from '@/lib/demo';
import { useSessionUser } from '@/lib/session';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** Business hub (spec §2: Profile, Portfolio, Packages, Analytics, Documents, Payments, Settings). */
export default function Business() {
  const { vendor } = useOwnVendor();
  const { user } = useSessionUser();
  const [busy, setBusy] = useState<string | null>(null);
  const isDemo = Boolean(user?.email.endsWith('@demo.soon'));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch {
      notify('הפעולה נכשלה', 'נסו שוב בעוד רגע.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen eyebrow="העסק שלי" title="העסק">
      <Reveal style={styles.cover}>
        {vendor.coverUrl ? <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
        <LinearGradient colors={['rgba(36,18,15,0)', 'rgba(36,18,15,0.8)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.coverText}>
          <Text variant="eyebrow" color={colors.goldLight}>
            {vendor.categoryLabel}
          </Text>
          <Text color={colors.inverse} style={styles.name}>
            {vendor.businessName}
          </Text>
          <StatusBadge status={vendor.status} />
        </View>
      </Reveal>

      <Reveal index={1}>
        <Card style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="edit-3" label="פרטי העסק" hint="שם, תחום, אזורים, מחירים, אודות" onPress={() => router.push('/vendor/profile')} />
          <ListRow icon="image" label="תיק עבודות" hint={`קאבר, לוגו ו־${vendor.media.length} תמונות`} onPress={() => router.push('/vendor/portfolio')} />
          <ListRow
            icon="package"
            label="חבילות ומחירים"
            hint={vendor.packages.length ? `${vendor.packages.length} חבילות` : 'עדיין אין חבילות'}
            onPress={() => router.push('/vendor/packages')}
          />
          <ListRow
            icon="help-circle"
            label="שאלות נפוצות"
            hint={vendor.faqs.length ? `${vendor.faqs.length} שאלות` : 'עדיין אין שאלות'}
            onPress={() => router.push('/vendor/faq')}
          />
          <ListRow
            icon="eye"
            label="תצוגה מקדימה"
            hint="כך זוגות רואים את העמוד שלכם"
            onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug, preview: '1' } })}
          />
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card tone="muted" style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="bar-chart-2" label="סטטיסטיקות מתקדמות" hint="בקרוב" disabled />
          <ListRow icon="file-text" label="מסמכים והסכמים דיגיטליים" hint="בקרוב" disabled />
          <ListRow icon="credit-card" label="סליקת תשלומים" hint="בקרוב" disabled />
        </Card>
      </Reveal>

      {isDemo ? (
        <Reveal index={3} style={{ gap: space.sm }}>
          <View style={styles.demoPill}>
            <Text variant="eyebrow" color={colors.gold}>
              כלי דמו
            </Text>
          </View>
          <Card tone="muted" style={{ paddingVertical: space.xs, gap: 0 }}>
            <ListRow
              icon="heart"
              label={busy === 'couple' ? 'עוברים לצד הזוג…' : 'מעבר לצד הזוג'}
              hint="ראו את האפליקציה כמו שזוג רואה אותה"
              disabled={!!busy}
              onPress={() => run('couple', () => signInDemo('couple'))}
            />
            <ListRow
              icon="rotate-ccw"
              label={busy === 'reset' ? 'מאפסים…' : 'איפוס נתוני הדמו'}
              hint="חזרה למצב ההתחלתי"
              disabled={!!busy}
              onPress={async () => {
                if (await confirm('איפוס נתוני הדמו', 'כל השינויים בחשבונות הדמו יימחקו.', 'איפוס')) {
                  await run('reset', async () => {
                    await resetDemo();
                    await signInDemo('vendor');
                  });
                }
              }}
            />
            <ListRow icon="chevrons-right" label="חזרה למסך הפתיחה" disabled={!!busy} onPress={() => run('start', signOutToStart)} />
          </Card>
        </Reveal>
      ) : (
        <Card tone="muted" style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="log-out" label="התנתקות" onPress={() => run('start', signOutToStart)} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.night, ...shadow.md },
  coverText: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: space.lg, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  demoPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.goldSoft },
});
