import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PLANS, type VendorAccountDTO } from '@soon/shared';

import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ListRow, StatusBadge } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { resetDemo, signInDemo, signOutToStart } from '@/lib/demo';
import { keys, useApiQuery } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, fonts, space } from '@/theme/tokens';

const go = (href: string) => () => router.push(href as Href);

/** Business hub: the storefront (edited in place), numbers, money & documents, plan, settings. */
export default function Business() {
  const { vendor } = useOwnVendor();
  const { user } = useSessionUser();
  const account = useApiQuery<VendorAccountDTO>(keys.account, '/api/vendors/me/account').data;
  const [busy, setBusy] = useState<string | null>(null);
  const isDemo = Boolean(user?.email.endsWith('@demo.soon'));
  const plan = PLANS.find((p) => p.key === account?.plan);

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
    <Screen eyebrow="ניהול העסק" title="העסק">
      <PressableScale onPress={go('/vendor/storefront')} style={styles.cover} accessibilityRole="button" accessibilityLabel="פרטי העסק">
        {vendor.coverUrl ? <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.coverText}>
          <Text variant="eyebrow" color="rgba(255,255,255,0.75)">
            {vendor.categoryLabel}
          </Text>
          <Text color={colors.inverse} style={styles.name}>
            {vendor.businessName}
          </Text>
          <View style={styles.coverRow}>
            <StatusBadge status={vendor.status} />
            <Text variant="caption" color={colors.inverse} style={{ fontFamily: fonts.bodyMedium }}>
              צפייה ועריכה של עמוד העסק ←
            </Text>
          </View>
        </View>
      </PressableScale>

      <Group title="העסק שלי">
        <ListRow icon="user" label="פרטי העסק" hint="העמוד שזוגות רואים — עריכה ישירה מתוכו" onPress={go('/vendor/storefront')} />
        <ListRow icon="bar-chart-2" label="נתונים וסטטיסטיקות" hint="צפיות, שמירות, פניות ועסקאות לפי שבועות" onPress={go('/vendor/stats')} />
      </Group>

      <Group title="כספים ומסמכים">
        <ListRow icon="trending-up" label="הכנסות ותשלומים" hint="נגבה, צפוי להיכנס, מקדמות ויתרות" onPress={go('/vendor/finance?tab=income')} />
        <ListRow icon="file-minus" label="הוצאות העסק" hint="טבלת הוצאות עם קבלות וחשבוניות" onPress={go('/vendor/finance?tab=expenses')} />
        <ListRow icon="file-text" label="מסמכים ללקוחות" hint="קבלות, הצעות מחיר ודרישות תשלום" onPress={go('/vendor/finance?tab=documents')} />
      </Group>

      <Group title="חשבון">
        <ListRow icon="award" label="מנוי האפליקציה" hint={plan ? `המסלול הנוכחי: ${plan.name}` : 'מסלולים ושדרוג'} onPress={go('/vendor/subscription')} />
        <ListRow icon="settings" label="הגדרות" hint="התראות, חשבון, שפה והעדפות" onPress={go('/vendor/settings')} />
      </Group>

      {isDemo ? (
        <Group title="כלי דמו">
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
        </Group>
      ) : (
        <Group title="">
          <ListRow icon="log-out" label="התנתקות" onPress={() => run('start', signOutToStart)} />
        </Group>
      )}
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      {title ? (
        <Text variant="eyebrow" color={colors.inkMuted}>
          {title}
        </Text>
      ) : null}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.ink }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 210, overflow: 'hidden', backgroundColor: colors.night },
  coverText: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: space.lg, gap: 4 },
  coverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  name: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
});
