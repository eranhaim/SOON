import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatAgorot, type CoupleHomeDTO } from '@soon/shared';

import { PressableScale, Reveal } from '@/components/motion';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, IconBadge, ListRow, SectionTitle, type IconName } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** Planning hub (spec §2: Checklist, Budget, Guests, Calendar, Alcohol, Vendors, Payments). */
export default function Planning() {
  const home = useApiQuery<CoupleHomeDTO>(keys.home, '/api/couple/home').data;
  const t = home?.tasks;
  const b = home?.budget;
  const v = home?.vendors;

  return (
    <Screen eyebrow="כלי תכנון" title="תכנון החתונה">
      <View style={styles.grid}>
        <BigTile
          index={0}
          icon="pie-chart"
          label="תקציב"
          value={b ? formatAgorot(b.committedAgorot) : '—'}
          sub={b?.totalAgorot ? `מתוך ${formatAgorot(b.totalAgorot)}` : 'הגדירו תקציב'}
          progress={b?.totalAgorot ? b.committedAgorot / b.totalAgorot : 0}
          href="/couple/planning/budget"
        />
        <BigTile
          index={1}
          icon="users"
          label="הספקים שלי"
          value={v ? String(v.closed) : '—'}
          sub={v ? `מתוך ${v.closed + v.needed} קטגוריות` : ''}
          progress={v ? v.closed / Math.max(1, v.closed + v.needed) : 0}
          href="/couple/planning/vendors"
        />
        <BigTile
          index={2}
          icon="check-square"
          label="משימות"
          value={t ? String(t.done) : '—'}
          sub={t ? `מתוך ${t.done + t.open}${t.overdue ? ` · ${t.overdue} באיחור` : ''}` : ''}
          progress={t ? t.done / Math.max(1, t.done + t.open) : 0}
          href="/couple/planning/checklist"
        />
        <BigTile
          index={3}
          icon="calendar"
          label="יומן"
          value={home?.nextEvent ? 'הבא בתור' : 'פנוי'}
          sub={home?.nextEvent?.title ?? 'פגישות, טעימות ומדידות'}
          href="/couple/planning/calendar"
        />
      </View>

      <Reveal index={4}>
        <SectionTitle eyebrow="עוד כלים">אורחים ותשלומים</SectionTitle>
      </Reveal>
      <Reveal index={5}>
        <Card style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="user-check" label="רשימת מוזמנים" hint="אישורי הגעה, צדדים ושולחנות" onPress={() => router.push('/couple/planning/guests')} />
          <ListRow
            icon="credit-card"
            label="תשלומים"
            hint={b ? `שולם ${formatAgorot(b.paidAgorot)}` : undefined}
            onPress={() => router.push({ pathname: '/couple/planning/budget', params: { tab: 'payments' } })}
          />
          <ListRow icon="droplet" label="מחשבון אלכוהול" hint="הערכת כמויות לפי מספר האורחים" onPress={() => router.push('/couple/planning/alcohol')} />
        </Card>
      </Reveal>

      <Reveal index={6}>
        <Card tone="muted" style={{ paddingVertical: space.xs, gap: 0 }}>
          <ListRow icon="layout" label="סידורי הושבה" hint="בקרוב" disabled />
          <ListRow icon="mail" label="הזמנות דיגיטליות ואישורי הגעה ב־WhatsApp" hint="בקרוב" disabled />
        </Card>
      </Reveal>
    </Screen>
  );
}

function BigTile({
  index,
  icon,
  label,
  value,
  sub,
  progress,
  href,
}: {
  index: number;
  icon: IconName;
  label: string;
  value: string;
  sub: string;
  progress?: number;
  href: Href;
}) {
  return (
    <Reveal index={index} style={styles.tileWrap}>
      <PressableScale scaleTo={0.97} onPress={() => router.push(href)} style={styles.tile}>
        <View style={styles.tileTop}>
          <IconBadge icon={icon} size={36} />
          <Feather name="arrow-up-left" size={16} color={colors.stoneDeep} />
        </View>
        <Text variant="eyebrow" color={colors.gold} style={{ letterSpacing: 1.2 }}>
          {label}
        </Text>
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
          {sub}
        </Text>
        {progress != null ? <ProgressBar value={progress} style={{ marginTop: 4 }} /> : null}
      </PressableScale>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  tileWrap: { width: '48%' },
  tile: { padding: space.md, gap: 4, borderRadius: radius.lg, backgroundColor: colors.surface, minHeight: 168, ...shadow.sm },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.sm },
  value: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.ink },
});
