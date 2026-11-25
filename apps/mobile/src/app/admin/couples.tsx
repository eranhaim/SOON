import { StyleSheet, View } from 'react-native';

import { formatAgorot, regionLabel, type AdminCoupleDTO } from '@soon/shared';

import { AdminNav } from '@/components/AdminNav';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { formatDate, formatDayDots } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** Every couple and how far they are: tasks, vendors booked, budget, guests, site, gifts. */
export default function AdminCouples() {
  const q = useApiQuery<AdminCoupleDTO[]>(['admin-couples'], '/api/admin/couples');
  return (
    <Screen title="זוגות והתקדמות" subtitle="איפה כל זוג נמצא בתכנון" maxWidth={960} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <AdminNav />
      <Text variant="caption" color={colors.inkMuted}>{`${q.data?.length ?? 0} זוגות`}</Text>
      <View style={styles.grid}>
        {q.data?.map((c) => {
          const pct = c.tasks.total ? c.tasks.done / c.tasks.total : 0;
          return (
            <View key={c.weddingId} style={styles.card}>
              <View style={{ gap: 2 }}>
                <Text variant="h3">{c.names}</Text>
                <Text variant="caption" color={colors.inkMuted}>
                  {[c.weddingDate ? formatDayDots(c.weddingDate) : 'ללא תאריך', c.region ? regionLabel(c.region) : null, `הצטרפו ${formatDate(c.createdAt)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <Text variant="caption" color={colors.inkSoft}>
                  {c.members.map((m) => m.email).join(', ')}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="caption" color={colors.inkSoft}>{`משימות ${c.tasks.done}/${c.tasks.total}`}</Text>
                <ProgressBar value={pct} color={colors.accent} />
              </View>
              <View style={styles.stats}>
                <Stat label="ספקים סגורים" value={String(c.vendorsBooked)} />
                <Stat label="מוזמנים" value={String(c.guests)} />
                <Stat label="תקציב" value={c.budgetTotalAgorot ? `${Math.round((c.budgetCommittedAgorot / c.budgetTotalAgorot) * 100)}%` : '—'} />
                <Stat label="מתנות" value={formatAgorot(c.giftsPaidAgorot)} />
              </View>
              <Text variant="caption" color={c.sitePublished ? colors.success : colors.inkMuted}>
                {c.sitePublished ? 'אתר החתונה באוויר' : 'אתר החתונה לא פורסם'}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink }}>{value}</Text>
      <Text variant="caption" color={colors.inkMuted}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  card: { flexGrow: 1, flexBasis: 300, gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  stats: { flexDirection: 'row', gap: space.sm },
});
