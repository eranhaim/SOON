import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatAgorot, type CoupleHomeDTO, type SongDTO } from '@soon/shared';

import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ListRow } from '@/components/ui';
import { formatDateTime } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, PHOTOS, space } from '@/theme/tokens';

/**
 * Planning (spec §2): one ordered list of tools, grouped — deliberately different from the
 * home page's tiles. The AI invitation gets a large feature block at the top.
 */
export default function Planning() {
  const home = useApiQuery<CoupleHomeDTO>(keys.home, '/api/couple/home').data;
  const songs = useApiQuery<SongDTO[]>(keys.playlist, '/api/planning/playlist').data;
  const t = home?.tasks;
  const b = home?.budget;
  const v = home?.vendors;

  return (
    <Screen eyebrow="כלי תכנון" title="תכנון החתונה">
      <PressableScale onPress={() => router.push('/couple/planning/invitation' as Href)} style={styles.feature}>
        <Image source={PHOTOS.heroRings} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFill} />
        <View style={styles.featureText}>
          <Text variant="eyebrow" color="rgba(255,255,255,0.8)">
            חדש · בינה מלאכותית
          </Text>
          <Text color={colors.inverse} style={styles.featureTitle}>
            ההזמנה שלכם, מוכנה בדקה
          </Text>
          <Text variant="bodySmall" color="rgba(255,255,255,0.85)">
            הזינו את פרטי האירוע ובחרו סגנון. ה־AI יכתוב נוסח אישי, ואנחנו נעצב אותו להזמנה מוכנה לשליחה.
          </Text>
          <View style={styles.featureCta}>
            <Text variant="label" color={colors.ink}>
              יצירת הזמנה
            </Text>
            <Feather name="arrow-left" size={16} color={colors.ink} />
          </View>
        </View>
      </PressableScale>

      <Group title="התכנון שלנו">
        <ListRow
          icon="pie-chart"
          label="תקציב"
          hint={b?.totalAgorot ? `${formatAgorot(b.committedAgorot)} מתוך ${formatAgorot(b.totalAgorot)}` : 'הגדירו תקציב וחלוקה'}
          onPress={() => router.push('/couple/planning/budget')}
        />
        <ListRow
          icon="users"
          label="הספקים שלי"
          hint={v ? `${v.closed} מתוך ${v.closed + v.needed} קטגוריות נסגרו` : undefined}
          onPress={() => router.push('/couple/planning/vendors')}
        />
        <ListRow
          icon="check-square"
          label="משימות"
          hint={t ? `${t.done} הושלמו · ${t.open} פתוחות${t.overdue ? ` · ${t.overdue} באיחור` : ''}` : undefined}
          onPress={() => router.push('/couple/planning/checklist')}
        />
        <ListRow
          icon="calendar"
          label="יומן החתונה"
          hint={home?.nextEvent ? `הבא: ${home.nextEvent.title} · ${formatDateTime(home.nextEvent.startsAt)}` : 'פגישות, טעימות ומדידות'}
          onPress={() => router.push('/couple/planning/calendar')}
        />
        <ListRow
          icon="credit-card"
          label="תשלומים"
          hint={b ? `שולם ${formatAgorot(b.paidAgorot)}` : undefined}
          onPress={() => router.push({ pathname: '/couple/planning/budget', params: { tab: 'payments' } })}
        />
      </Group>

      <Group title="האורחים">
        <ListRow icon="user-check" label="רשימת מוזמנים" hint="אישורי הגעה, צדדים ושולחנות" onPress={() => router.push('/couple/planning/guests')} />
        <ListRow icon="mail" label="הזמנה לחתונה" hint="נוסח בעזרת AI, מעוצב ומוכן לשליחה" onPress={() => router.push('/couple/planning/invitation' as Href)} />
        <ListRow icon="layout" label="סידורי הושבה" hint="בקרוב" disabled />
      </Group>

      <Group title="החוויה">
        <ListRow
          icon="music"
          label="פלייליסט החתונה"
          hint={songs ? `${songs.length} שירים לפי שלבי האירוע` : 'שירים לפי שלבי האירוע'}
          onPress={() => router.push('/couple/planning/playlist' as Href)}
        />
        <ListRow icon="droplet" label="מחשבון אלכוהול" hint="הערכת כמויות לפי מספר האורחים" onPress={() => router.push('/couple/planning/alcohol')} />
      </Group>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="eyebrow" color={colors.inkMuted}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  feature: { height: 300, overflow: 'hidden', backgroundColor: colors.night, justifyContent: 'flex-end' },
  featureText: { padding: space.lg, gap: space.sm },
  featureTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38 },
  featureCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'flex-start',
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: colors.inverse,
  },
  group: { borderTopWidth: 1, borderTopColor: colors.ink },
});
