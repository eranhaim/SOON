import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  isoDateOf,
  todayIso,
  WEDDING_EVENT_KIND_LABELS,
  WEDDING_EVENT_KINDS,
  type WeddingEventDTO,
  type WeddingEventKind,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { MonthCalendar, type DayMark } from '@/components/MonthCalendar';
import { Loading, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup, IconButton, SectionTitle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { formatDayShort, formatTime, isTime, toInstant } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { useOwnWedding } from '@/lib/wedding';
import { colors, hairline, space } from '@/theme/tokens';

type Draft = { id?: string; kind: WeddingEventKind; title: string; date: string | null; time: string; location: string; notes: string };

/** Wedding calendar (spec §7.3): meetings, tastings, fittings, trials, payments, deadlines. */
export default function WeddingCalendar() {
  const wedding = useOwnWedding();
  const q = useApiQuery<WeddingEventDTO[]>(keys.events, '/api/planning/events');
  const m = useApiMutation<WeddingEventDTO[]>({ setData: keys.events, invalidate: [keys.home] });
  const [month, setMonth] = useState(todayIso());
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();

  if (q.isPending) return <Loading />;
  const events = q.data ?? [];
  const marks: Record<string, DayMark[]> = {};
  for (const e of events) (marks[isoDateOf(e.startsAt)] ??= []).push({ color: colors.ink });
  if (wedding.weddingDate) (marks[wedding.weddingDate] ??= []).unshift({ color: colors.danger });

  const today = todayIso();
  const list = selected ? events.filter((e) => isoDateOf(e.startsAt) === selected) : events.filter((e) => isoDateOf(e.startsAt) >= today);

  async function save() {
    if (!draft?.title.trim() || !draft.date) return setError('נא למלא כותרת ותאריך');
    if (!isTime(draft.time)) return setError('שעה בפורמט 18:30');
    setError(undefined);
    const json = {
      kind: draft.kind,
      title: draft.title,
      startsAt: toInstant(draft.date, draft.time),
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
    };
    try {
      await m.mutateAsync(draft.id ? { path: `/api/planning/events/${draft.id}`, method: 'PATCH', json } : { path: '/api/planning/events', json });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen
      title="יומן החתונה"
      back
      backTo="/couple/planning"
      right={
        <IconButton icon="plus" label="אירוע חדש" onPress={() => setDraft({ kind: 'meeting', title: '', date: selected ?? today, time: '18:00', location: '', notes: '' })} />
      }>
      <MonthCalendar month={month} onMonthChange={setMonth} selected={selected} onSelect={(d) => setSelected(selected === d ? null : d)} marks={marks} />
      <SectionTitle>{selected ? formatDayShort(selected) : 'אירועים קרובים'}</SectionTitle>
      <View>
        {list.map((e) => (
          <Pressable
            key={e.id}
            disabled={e.fromVendor}
            onPress={() =>
              setDraft({
                id: e.id,
                kind: e.kind,
                title: e.title,
                date: isoDateOf(e.startsAt),
                time: formatTime(e.startsAt),
                location: e.location ?? '',
                notes: e.notes ?? '',
              })
            }
            style={styles.row}>
            <View style={{ width: 64 }}>
              <Text variant="caption" color={colors.inkMuted}>{formatDayShort(isoDateOf(e.startsAt))}</Text>
              <Text variant="body">{formatTime(e.startsAt)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body">{e.title}</Text>
              <Text variant="caption" color={colors.inkSoft}>
                {[e.fromVendor ? 'נקבע על ידי הספק' : WEDDING_EVENT_KIND_LABELS[e.kind], e.vendorName, e.location].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
        ))}
        {!list.length ? <Text color={colors.inkSoft}>{selected ? 'אין אירועים ביום הזה.' : 'אין אירועים קרובים.'}</Text> : null}
      </View>

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'עריכת אירוע' : 'אירוע חדש'}
        footer={
          <>
            {draft?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (!(await confirm('מחיקה', draft.title, 'מחיקה'))) return;
                  await m.mutateAsync({ path: `/api/planning/events/${draft.id}`, method: 'DELETE' });
                  setDraft(null);
                }}
              />
            ) : null}
            <Button label="שמירה" loading={m.isPending} style={{ flex: 2 }} onPress={save} />
          </>
        }>
        {draft ? (
          <>
            <ChipGroup>
              {WEDDING_EVENT_KINDS.map((k) => (
                <Chip key={k} label={WEDDING_EVENT_KIND_LABELS[k]} selected={draft.kind === k} onPress={() => setDraft({ ...draft, kind: k })} />
              ))}
            </ChipGroup>
            <TextField label="כותרת" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 2 }}>
                <DateField label="תאריך" value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="שעה" ltr value={draft.time} onChangeText={(time) => setDraft({ ...draft, time })} placeholder="18:00" />
              </View>
            </View>
            <TextField label="מיקום" value={draft.location} onChangeText={(location) => setDraft({ ...draft, location })} />
            <TextField label="הערות" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline />
            {error ? <Text variant="bodySmall" color={colors.danger}>{error}</Text> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: hairline, borderBottomColor: colors.line },
});
