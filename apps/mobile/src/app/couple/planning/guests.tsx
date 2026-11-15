import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  GUEST_SIDE_LABELS,
  GUEST_SIDES,
  RSVP_STATUS_LABELS,
  RSVP_STATUSES,
  type GuestDTO,
  type GuestListDTO,
  type GuestSide,
  type RsvpStatus,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, Chip, ChipGroup, IconButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, hairline, space } from '@/theme/tokens';

type Draft = { id?: string; name: string; side: GuestSide; phone: string; rsvp: RsvpStatus; partySize: string; tableLabel: string; notes: string };
const EMPTY: Draft = { name: '', side: 'shared', phone: '', rsvp: 'invited', partySize: '1', tableLabel: '', notes: '' };

/** Guest list (spec §7.3): side, phone, RSVP, party size, table, notes. */
export default function Guests() {
  const q = useApiQuery<GuestListDTO>(keys.guests, '/api/planning/guests');
  const m = useApiMutation<GuestListDTO>({ setData: keys.guests });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bulk, setBulk] = useState<{ text: string; side: GuestSide } | null>(null);
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null);
  const [error, setError] = useState<string>();

  if (q.isPending) return <Loading />;
  const { guests, people } = q.data!;
  const shown = rsvp ? guests.filter((g) => g.rsvp === rsvp) : guests;

  const edit = (g: GuestDTO) =>
    setDraft({
      id: g.id,
      name: g.name,
      side: g.side,
      phone: g.phone ?? '',
      rsvp: g.rsvp,
      partySize: String(g.partySize),
      tableLabel: g.tableLabel ?? '',
      notes: g.notes ?? '',
    });

  async function save() {
    if (!draft?.name.trim()) return setError('נא לכתוב שם');
    setError(undefined);
    const json = {
      name: draft.name,
      side: draft.side,
      phone: draft.phone.trim() || null,
      rsvp: draft.rsvp,
      partySize: Math.max(1, Math.min(50, Number(draft.partySize) || 1)),
      tableLabel: draft.tableLabel.trim() || null,
      notes: draft.notes.trim() || null,
    };
    try {
      await m.mutateAsync(draft.id ? { path: `/api/planning/guests/${draft.id}`, method: 'PATCH', json } : { path: '/api/planning/guests', json });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen
      title="רשימת מוזמנים"
      back
      backTo="/couple/planning"
      right={
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IconButton icon="list" label="הוספה מהירה" onPress={() => setBulk({ text: '', side: 'shared' })} />
          <IconButton icon="plus" label="מוזמן חדש" onPress={() => setDraft(EMPTY)} />
        </View>
      }>
      <Card tone="muted">
        <View style={styles.stats}>
          <Stat label="סה״כ אנשים" value={people.total} />
          <Stat label="אישרו" value={people.confirmed} />
          <Stat label="ממתינים" value={people.waiting + people.invited} />
          <Stat label="לא מגיעים" value={people.declined} />
        </View>
      </Card>
      <ChipGroup>
        <Chip label="הכל" count={guests.length} selected={!rsvp} onPress={() => setRsvp(null)} />
        {RSVP_STATUSES.map((s) => (
          <Chip key={s} label={RSVP_STATUS_LABELS[s]} selected={rsvp === s} onPress={() => setRsvp(rsvp === s ? null : s)} />
        ))}
      </ChipGroup>
      <View>
        {shown.map((g) => (
          <Pressable key={g.id} onPress={() => edit(g)} style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body">{g.name}</Text>
              <Text variant="caption" color={colors.inkMuted}>
                {[GUEST_SIDE_LABELS[g.side], g.tableLabel ? `שולחן ${g.tableLabel}` : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text variant="caption" color={colors.inkSoft}>{RSVP_STATUS_LABELS[g.rsvp]}</Text>
            <Text variant="body" style={{ minWidth: 28 }} align="end">
              {g.partySize}
            </Text>
          </Pressable>
        ))}
        {!shown.length ? <Text color={colors.inkSoft}>עוד אין מוזמנים ברשימה.</Text> : null}
      </View>

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id ? 'עריכת מוזמן' : 'מוזמן חדש'}
        footer={
          <>
            {draft?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (!(await confirm('מחיקה', draft.name, 'מחיקה'))) return;
                  await m.mutateAsync({ path: `/api/planning/guests/${draft.id}`, method: 'DELETE' });
                  setDraft(null);
                }}
              />
            ) : null}
            <Button label="שמירה" loading={m.isPending} style={{ flex: 2 }} onPress={save} />
          </>
        }>
        {draft ? (
          <>
            <TextField label="שם (או משפחה)" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
            <ChipGroup>
              {GUEST_SIDES.map((s) => (
                <Chip key={s} label={GUEST_SIDE_LABELS[s]} selected={draft.side === s} onPress={() => setDraft({ ...draft, side: s })} />
              ))}
            </ChipGroup>
            <ChipGroup>
              {RSVP_STATUSES.map((s) => (
                <Chip key={s} label={RSVP_STATUS_LABELS[s]} selected={draft.rsvp === s} onPress={() => setDraft({ ...draft, rsvp: s })} />
              ))}
            </ChipGroup>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="מספר אנשים" ltr keyboardType="number-pad" value={draft.partySize} onChangeText={(partySize) => setDraft({ ...draft, partySize })} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="שולחן" value={draft.tableLabel} onChangeText={(tableLabel) => setDraft({ ...draft, tableLabel })} />
              </View>
            </View>
            <TextField label="טלפון" ltr keyboardType="phone-pad" value={draft.phone} onChangeText={(phone) => setDraft({ ...draft, phone })} />
            <TextField label="הערות" value={draft.notes} onChangeText={(notes) => setDraft({ ...draft, notes })} multiline />
            {error ? <Text variant="bodySmall" color={colors.danger}>{error}</Text> : null}
          </>
        ) : null}
      </Sheet>

      <Sheet
        visible={bulk != null}
        onClose={() => setBulk(null)}
        title="הוספה מהירה"
        footer={
          <Button
            label="הוספה"
            loading={m.isPending}
            style={{ flex: 1 }}
            onPress={async () => {
              const names = (bulk?.text ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
              if (!names.length) return;
              try {
                await m.mutateAsync({ path: '/api/planning/guests/bulk', json: { names, side: bulk!.side } });
                setBulk(null);
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          />
        }>
        {bulk ? (
          <>
            <Text variant="bodySmall" color={colors.inkSoft}>שם אחד בכל שורה.</Text>
            <ChipGroup>
              {GUEST_SIDES.map((s) => (
                <Chip key={s} label={GUEST_SIDE_LABELS[s]} selected={bulk.side === s} onPress={() => setBulk({ ...bulk, side: s })} />
              ))}
            </ChipGroup>
            <TextField label="שמות" value={bulk.text} onChangeText={(text) => setBulk({ ...bulk, text })} multiline style={{ minHeight: 160 }} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '22%', gap: 2 }}>
      <Text variant="h2">{String(value)}</Text>
      <Text variant="caption" color={colors.inkSoft}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: hairline, borderBottomColor: colors.line },
});
