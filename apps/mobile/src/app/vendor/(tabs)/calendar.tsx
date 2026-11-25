import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  addDays,
  AVAILABILITY_STATUS_LABELS,
  CALENDAR_ENTRY_KIND_LABELS,
  formatAgorot,
  isoDateOf,
  shekelsToAgorot,
  todayIso,
  type AvailabilityStatus,
  type CalendarEntryDTO,
  type CoupleSearchItem,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { CalendarSyncSheet } from '@/components/CalendarSyncSheet';
import { CoupleSearch } from '@/components/CoupleSearch';
import { DateField } from '@/components/DateField';
import { MonthCalendar, type DayMark } from '@/components/MonthCalendar';
import { PressableScale, Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { TimeSelect } from '@/components/TimeSelect';
import { Card, Chip, ChipGroup, EmptyState } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDay, formatTime, toInstant } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  booked: colors.accent,
  pending: colors.gold,
  unavailable: colors.inkMuted,
  available: colors.stoneDeep,
};

/** Vendor calendar (spec §11): bookings, holds and personal time; drives "available on your date". */
export default function VendorCalendar() {
  const q = useApiQuery<CalendarEntryDTO[]>(keys.calendar, '/api/calendar');
  const [month, setMonth] = useState(todayIso());
  const [selected, setSelected] = useState(todayIso());
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
      right={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="סנכרון" icon="refresh-cw" size="sm" variant="outline" onPress={() => setSyncing(true)} />
          <Button label="חסימה" icon="plus" size="sm" onPress={() => setAdding(true)} />
        </View>
      }>
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
                    {e.title ?? e.coupleNames ?? e.clientName ?? CALENDAR_ENTRY_KIND_LABELS[e.kind]}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                    {[
                      AVAILABILITY_STATUS_LABELS[e.status],
                      CALENDAR_ENTRY_KIND_LABELS[e.kind],
                      e.title && e.coupleNames ? e.coupleNames : null,
                      e.location,
                      e.depositAgorot ? `מקדמה ${formatAgorot(e.depositAgorot)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
      <CalendarSyncSheet visible={syncing} onClose={() => setSyncing(false)} />
    </Screen>
  );
}

type EntryKind = 'event' | 'meeting' | 'call' | 'personal';
const KIND_CHIPS: { key: EntryKind; label: string }[] = [
  { key: 'event', label: 'אירוע' },
  { key: 'meeting', label: 'פגישה' },
  { key: 'call', label: 'שיחת התאמה' },
  { key: 'personal', label: 'אישי / חופש' },
];

/** New calendar entry: what, which couple (from SOON), when (times from a list), where, deposit. */
function AddEntrySheet({ visible, date, onClose }: { visible: boolean; date: string; onClose: () => void }) {
  const [kind, setKind] = useState<EntryKind>('event');
  const [status, setStatus] = useState<AvailabilityStatus>('booked');
  const [title, setTitle] = useState('');
  const [day, setDay] = useState<string | null>(date);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('23:30');
  const [location, setLocation] = useState('');
  const [deposit, setDeposit] = useState('');
  const [note, setNote] = useState('');
  const [couple, setCouple] = useState<CoupleSearchItem | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();
  const create = useApiMutation({ invalidate: [keys.calendar, keys.dashboard, keys.leads] });

  // The sheet opens on the day the vendor tapped.
  const [seenDate, setSeenDate] = useState(date);
  if (date !== seenDate) {
    setSeenDate(date);
    setDay(date);
  }

  function pickKind(k: EntryKind) {
    setKind(k);
    if (k === 'personal') setStatus('unavailable');
    else if (status === 'unavailable') setStatus('booked');
    if (k === 'meeting' || k === 'call') {
      setStart('10:00');
      setEnd(k === 'call' ? '10:30' : '11:00');
    } else if (k === 'event') {
      setStart('18:00');
      setEnd('23:30');
    }
  }

  function reset() {
    setTitle('');
    setLocation('');
    setDeposit('');
    setNote('');
    setCouple(null);
    setError(undefined);
  }

  function save() {
    setError(undefined);
    if (!day) return setError('בחרו תאריך');
    // An event that ends after midnight ends the next day.
    const endDay = end <= start ? addDays(day, 1) : day;
    create.mutate(
      {
        path: '/api/calendar',
        json: {
          status,
          kind,
          startsAt: toInstant(day, start),
          endsAt: toInstant(endDay, end),
          title: title.trim() || null,
          location: location.trim() || null,
          note: note.trim() || null,
          weddingId: couple?.weddingId ?? null,
          deposit: shekelsToAgorot(deposit),
        },
      },
      { onSuccess: () => (reset(), onClose()), onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={day ? formatDay(day) : 'יומן'}
      title="רשומה חדשה ביומן"
      footer={<Button label="שמירה" style={{ flex: 1 }} loading={create.isPending} onPress={save} />}>
      <ChipGroup>
        {KIND_CHIPS.map((k) => (
          <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => pickKind(k.key)} />
        ))}
      </ChipGroup>
      {kind !== 'personal' ? (
        <ChipGroup>
          {(['booked', 'pending'] as const).map((s) => (
            <Chip key={s} label={AVAILABILITY_STATUS_LABELS[s]} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </ChipGroup>
      ) : null}

      {kind !== 'personal' ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color={colors.inkSoft}>
            הזוג (לא חובה)
          </Text>
          {couple ? (
            <View style={styles.couplePill}>
              <Feather name="heart" size={14} color={colors.accent} />
              <Text variant="bodySmall" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
                {couple.names}
              </Text>
              <PressableScale accessibilityLabel="הסרת הזוג" onPress={() => setCouple(null)} hitSlop={8}>
                <Feather name="x" size={16} color={colors.inkMuted} />
              </PressableScale>
            </View>
          ) : picking ? (
            <CoupleSearch
              onPick={(c) => {
                setCouple(c);
                setPicking(false);
              }}
            />
          ) : (
            <Button variant="outline" size="sm" icon="search" label="חיפוש זוג מ־SOON" onPress={() => setPicking(true)} />
          )}
          {couple ? (
            <Text variant="caption" color={colors.inkMuted}>
              הרשומה תופיע בכרטיס הלקוח וגם ביומן של הזוג.
            </Text>
          ) : null}
        </View>
      ) : null}

      <TextField label="כותרת" placeholder={kind === 'personal' ? 'חופשה, יום אישי…' : 'חתונה, פגישת היכרות, טעימות…'} value={title} onChangeText={setTitle} />
      <DateField label="תאריך" value={day} onChange={setDay} />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TimeSelect label="משעה" value={start} onChange={setStart} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeSelect label="עד שעה" value={end} onChange={setEnd} />
        </View>
      </View>
      {kind !== 'personal' ? (
        <>
          <TextField label="מיקום" placeholder="שם האולם או הכתובת" value={location} onChangeText={setLocation} />
          {kind === 'event' ? (
            <TextField label="מקדמה (₪)" ltr keyboardType="number-pad" value={deposit} onChangeText={setDeposit} placeholder="0" />
          ) : null}
        </>
      ) : null}
      <TextField label="הערות" value={note} onChangeText={setNote} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
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
  couplePill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
});
