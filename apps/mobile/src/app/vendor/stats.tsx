import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { VendorStatsDTO, VendorWeekStat } from '@soon/shared';

import { BarChart } from '@/components/BarChart';
import { Loading, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { Chip, ChipGroup } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme/tokens';

type Metric = Exclude<keyof VendorWeekStat, 'weekStart'>;
const METRICS: { key: Metric; label: string; hint: string }[] = [
  { key: 'views', label: 'צפיות', hint: 'צפיות בעמוד העסק' },
  { key: 'saves', label: 'שמירות', hint: 'זוגות ששמרו את העסק' },
  { key: 'inquiries', label: 'פניות', hint: 'פניות ולקוחות חדשים' },
  { key: 'deals', label: 'עסקאות', hint: 'עסקאות שנסגרו' },
];

/** Business statistics (weekly), from real activity measured in the app. */
export default function Stats() {
  const { width } = useWindowDimensions();
  const [weeks, setWeeks] = useState<'8' | '12' | '26'>('12');
  const [metric, setMetric] = useState<Metric>('views');
  const q = useApiQuery<VendorStatsDTO>(keys.stats(Number(weeks)), `/api/vendors/me/stats?weeks=${weeks}`);
  const chartWidth = Math.min(width, 720) - space.lg * 2;

  if (q.isPending) return <Loading />;
  const s = q.data!;
  const current = METRICS.find((m) => m.key === metric)!;
  const values = s.weeks.map((w) => w[metric]);
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  const delta = prev ? Math.round(((last - prev) / prev) * 100) : null;

  return (
    <Screen back backTo="/vendor/business" title="נתונים וסטטיסטיקות" subtitle="לפי שבועות · נמדד באפליקציה" refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Segmented
        options={[
          { key: '8', label: '8 שבועות' },
          { key: '12', label: '12 שבועות' },
          { key: '26', label: 'חצי שנה' },
        ]}
        value={weeks}
        onChange={setWeeks}
      />

      <View style={styles.totals}>
        {METRICS.map((m, i) => (
          <View key={m.key} style={[styles.total, i % 2 === 1 && styles.totalSide, i >= 2 && styles.totalTop]}>
            <Text style={styles.totalNum}>{s.totals[m.key].toLocaleString('he-IL')}</Text>
            <Text variant="caption" color={colors.inkSoft}>
              {m.hint}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.conv}>
        <Conversion label="מצפייה לפנייה" value={s.viewToInquiry} detail={`${s.totals.inquiries} פניות מתוך ${s.totals.views.toLocaleString('he-IL')} צפיות`} />
        <View style={styles.convRule} />
        <Conversion label="מפנייה לעסקה" value={s.inquiryToDeal} detail={`${s.totals.deals} עסקאות מתוך ${s.totals.inquiries} פניות`} />
      </View>

      <View style={{ gap: space.md }}>
        <ChipGroup>
          {METRICS.map((m) => (
            <Chip key={m.key} label={m.label} selected={metric === m.key} onPress={() => setMetric(m.key)} />
          ))}
        </ChipGroup>
        <View style={styles.chartHead}>
          <Text variant="h2" style={{ flex: 1 }}>
            {current.hint}
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.lastNum}>{last.toLocaleString('he-IL')}</Text>
            <Text variant="caption" color={colors.inkMuted}>
              {delta == null ? 'השבוע' : `השבוע · ${delta >= 0 ? '+' : ''}${delta}% משבוע שעבר`}
            </Text>
          </View>
        </View>
        <BarChart values={values} labels={s.weeks.map((w) => `${w.weekStart.slice(8, 10)}.${w.weekStart.slice(5, 7)}`)} width={chartWidth} />
        <Text variant="caption" color={colors.inkMuted}>
          כל עמודה היא שבוע (ראשון עד שבת). העמודה השחורה היא השבוע הנוכחי.
        </Text>
      </View>
    </Screen>
  );
}

function Conversion({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="eyebrow" color="rgba(255,255,255,0.6)">
        {label}
      </Text>
      <Text style={styles.convNum}>{value == null ? '—' : `${value}%`}</Text>
      <Text variant="caption" color="rgba(255,255,255,0.7)">
        {detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: colors.line },
  total: { width: '50%', padding: space.md, gap: 2 },
  totalSide: { borderRightWidth: 1, borderRightColor: colors.line },
  totalTop: { borderTopWidth: 1, borderTopColor: colors.line },
  totalNum: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.ink },
  conv: { flexDirection: 'row', gap: space.md, padding: space.lg, backgroundColor: colors.night },
  convRule: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  convNum: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.inverse },
  chartHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  lastNum: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: colors.ink },
});
