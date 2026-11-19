import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatHebrewDate } from '@soon/shared';

import { CoverPicker } from '@/components/CoverPicker';
import { PressableScale, Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, ListRow } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { formatDay } from '@/lib/dates';
import { resetDemo, signInDemo, signOutToStart } from '@/lib/demo';
import { useSessionUser } from '@/lib/session';
import { useOwnWedding } from '@/lib/wedding';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Couple profile (spec §3): wedding details, background, messages, language, demo tools. */
export default function Profile() {
  const w = useOwnWedding();
  const { user } = useSessionUser();
  const [coverOpen, setCoverOpen] = useState(false);
  const [lang, setLang] = useState<'he' | 'en'>('he');
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
    <Screen>
      <Reveal style={styles.head}>
        <View style={styles.avatar}>
          <Text color={colors.inverse} style={styles.avatarText}>
            {w.partner1Name.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h1" style={{ fontSize: 28, lineHeight: 36 }}>{`${w.partner1Name} ו${w.partner2Name}`}</Text>
          <Text variant="bodySmall" color={colors.inkSoft}>
            {w.weddingDate ? formatDay(w.weddingDate) : 'התאריך עוד לא נקבע'}
            {w.venueName ? ` · ${w.venueName}` : ''}
          </Text>
          {w.weddingDate ? (
            <Text variant="bodySmall" color={colors.inkMuted}>
              {formatHebrewDate(w.weddingDate)}
            </Text>
          ) : null}
        </View>
      </Reveal>

      <Reveal index={1}>
        <Card style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="edit-3" label="פרטי החתונה" hint="שמות, תאריך, אזור ותקציב" onPress={() => router.push('/couple/wedding-details' as Href)} />
          <ListRow icon="camera" label="תמונת רקע" hint="החליפו את התמונה במסך הבית" onPress={() => setCoverOpen(true)} />
          <ListRow icon="message-circle" label="הודעות" hint="שיחות עם ספקים" onPress={() => router.push('/messages' as Href)} />
          <ListRow
            icon="globe"
            label="שפה"
            trailing={
              <View style={styles.lang}>
                {(['he', 'en'] as const).map((l) => (
                  <PressableScale
                    key={l}
                    accessibilityRole="button"
                    accessibilityState={{ selected: lang === l }}
                    onPress={() => {
                      if (l === 'en') notify('English', 'The English version is coming soon.');
                      else setLang(l);
                    }}
                    style={[styles.langItem, lang === l && styles.langOn]}>
                    <Text variant="caption" color={lang === l ? colors.inverse : colors.inkSoft} style={{ fontFamily: fonts.bodyMedium }}>
                      {l === 'he' ? 'עב' : 'EN'}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            }
          />
        </Card>
      </Reveal>

      {isDemo ? (
        <Reveal index={2} style={{ gap: space.sm }}>
          <View style={styles.demoPill}>
            <Text variant="eyebrow" color={colors.gold}>
              כלי דמו
            </Text>
          </View>
          <Card tone="muted" style={{ paddingVertical: space.xs, gap: 0 }}>
            <ListRow
              icon="briefcase"
              label={busy === 'vendor' ? 'עוברים לצד הספק…' : 'מעבר לצד הספק'}
              hint="ראו איך הספק מקבל את הפניות שלכם"
              disabled={!!busy}
              onPress={() => run('vendor', () => signInDemo('vendor'))}
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
                    await signInDemo('couple');
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

      <Text variant="caption" color={colors.inkMuted} align="center">
        {user?.email}
      </Text>

      <CoverPicker visible={coverOpen} onClose={() => setCoverOpen(false)} current={w.coverImageUrl} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  avatarText: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
  lang: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: colors.offWhite },
  langItem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill },
  langOn: { backgroundColor: colors.accent },
  demoPill: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.goldSoft },
});
