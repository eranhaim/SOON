import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AVAILABILITY_STATUS_LABELS,
  CALENDAR_ENTRY_KIND_LABELS,
  formatAgorot,
  isoDateOf,
  todayIso,
  type AvailabilityStatus,
  type CalendarEntryDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { MonthCalendar, type DayMark } from '@/components/MonthCalendar';
import { PressableScale, Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, Chip, ChipGroup, EmptyState } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDay, formatTime, toInstant } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  booked: colors.accent,
  pending: colors.gold,
  unavailable: colors.inkMuted,
  available: colors.success,
};

/** Vendor calendar (spec §11): bookings, holds and personal time; drives "available on your date". */
export default function VendorCalendar() {
  const q = useApiQuery<CalendarEntryDTO[]>(keys.calendar, '/api/calendar');
  const [month, setMonth] = useState(todayIso());
  const [selected, setSelected] = useState(todayIso());
  const [adding, setAdding] = useState(false);
  const entries = useMemo(() => q.data ?? [], [q.data]);

  const marks = useMemo(() => {
    const m: Record<string, DayMark[]> = {};
    for (const e of entries) {
      const day = isoDateOf(e.startsAt);
      (m[day] ??= []).push({ color: STATUS_COLOR[e.status], filled: e.status === 'booked' });
    }
    return m;
  }, [entries]);

  const dayEntries = entries.filter((e) => isoDateOf(e.startsAt) === selected);
  const monthKey = month.slice(0, 7);
  const monthEntries = entries.filter((e) => isoDateOf(e.startsAt).startsWith(monthKey));
  const bookedThisMonth = monthEntries.filter((e) => e.status === 'booked').length;

  return (
    <Screen
      eyebrow="יומן"
      title="היומן שלי"
      subtitle="מה שתסמנו כאן קובע אם תופיעו כ״פנויים״ לזוגות"
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
      right={<Button label="חסימה" icon="plus" size="sm" onPress={() => setAdding(true)} />}>
      <Reveal style={styles.calendarCard}>
        <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={setSelected} marks={marks} />
        <View style={styles.legend}>
          {(['booked', 'pending', 'unavailable'] as const).map((s) => (
            <View key={s} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[s] }]} />
              <Text variant="caption" color={colors.inkSoft}>
                {AVAILABILITY_STATUS_LABELS[s]}
              </Text>
            </View>
          ))}
        </View>
      </Reveal>

      <View style={styles.monthStats}>
        <Text variant="bodySmall" color={colors.inkSoft}>
          החודש
        </Text>
        <Text variant="label" color={colors.accent}>{`${bookedThisMonth} אירועים סגורים · ${monthEntries.length} רשומות`}</Text>
      </View>

      <Text variant="h2">{formatDay(selected)}</Text>
      {dayEntries.length ? (
        <View style={{ gap: space.sm }}>
          {dayEntries.map((e, i) => (
            <Reveal key={e.id} index={i}>
              <PressableScale
                scaleTo={0.98}
                disabled={!e.leadId}
                onPress={() => e.leadId && router.push({ pathname: '/vendor/lead/[id]', params: { id: e.leadId } })}
                style={[styles.entry, { borderRightColor: STATUS_COLOR[e.status] }]}>
                <View style={styles.time}>
                  <Text style={{ fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink }}>{formatTime(e.startsAt)}</Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {formatTime(e.endsAt)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3" numberOfLines={1}>
                    {e.clientName ?? e.title ?? CALENDAR_ENTRY_KIND_LABELS[e.kind]}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                    {[AVAILABILITY_STATUS_LABELS[e.status], CALENDAR_ENTRY_KIND_LABELS[e.kind], e.location].filter(Boolean).join(' · ')}
                  </Text>
                  {e.quotedPriceAgorot ? (
                    <Text variant="caption" color={colors.success}>{`שולם ${formatAgorot(e.paidAgorot)} מתוך ${formatAgorot(e.quotedPriceAgorot)}`}</Text>
                  ) : null}
                </View>
                {e.leadId ? <Feather name="chevron-left" size={18} color={colors.stoneDeep} /> : null}
              </PressableScale>
            </Reveal>
          ))}
        </View>
      ) : (
        <Card tone="muted">
          <EmptyState icon="sun" title="יום פנוי" body="אין אירועים ביום הזה. זוגות יראו אתכם כפנויים בתאריך." />
        </Card>
      )}

      <AddEntrySheet visible={adding} date={selected} onClose={() => setAdding(false)} />
    </Screen>
  );
}

function AddEntrySheet({ visible, date, onClose }: { visible: boolean; date: string; onClose: () => void }) {
  const [status, setStatus] = useState<AvailabilityStatus>('booked');
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('23:30');
  const [error, setError] = useState<string>();
  const create = useApiMutation({ invalidate: [keys.calendar, keys.dashboard] });

  function save() {
    setError(undefined);
    create.mutate(
      {
        path: '/api/calendar',
        json: {
          status,
          kind: status === 'unavailable' ? 'personal' : 'event',
          startsAt: toInstant(date, start),
          endsAt: toInstant(date, end),
          title: title.trim() || null,
        },
      },
      { onSuccess: () => (setTitle(''), onClose()), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={formatDay(date)}
      title="חסימת תאריך"
      footer={<Button label="שמירה" style={{ flex: 1 }} loading={create.isPending} onPress={save} />}>
      <ChipGroup>
        {(['booked', 'pending', 'unavailable'] as const).map((s) => (
          <Chip key={s} label={AVAILABILITY_STATUS_LABELS[s]} selected={status === s} onPress={() => setStatus(s)} />
        ))}
      </ChipGroup>
      <TextField label="כותרת" placeholder="חתונה, פגישה, חופשה…" value={title} onChangeText={setTitle} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField label="משעה" ltr value={start} onChangeText={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="עד שעה" ltr value={end} onChangeText={setEnd} error={error} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  calendarCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.md, ...shadow.sm },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  monthStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md, borderRadius: radius.md, backgroundColor: colors.offWhite },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderRightWidth: 4,
    ...shadow.sm,
  },
  time: { alignItems: 'center', width: 52 },
});
