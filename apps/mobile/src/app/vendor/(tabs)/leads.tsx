import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  formatAgorot,
  LEAD_PIPELINE,
  LEAD_STATUS_LABELS,
  shekelsToAgorot,
  type CoupleSearchItem,
  type LeadListItem,
  type LeadsDTO,
  type LeadStatus,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { CoupleSearch } from '@/components/CoupleSearch';
import { DateField } from '@/components/DateField';
import { PressableScale, Reveal } from '@/components/motion';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDayDots } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, hairline, radius, shadow, space, textStart } from '@/theme/tokens';

/** Side exits shown as one extra column at the end of the board. */
const OTHER: LeadStatus[] = ['pending', 'lost', 'cancelled'];

const COLUMN_TONE: Partial<Record<LeadStatus, string>> = {
  new: colors.accent,
  booked: colors.success,
  completed: colors.success,
};

/** CRM (spec §10): every client in its stage, from first inquiry to a completed event. */
export default function VendorLeads() {
  const { width } = useWindowDimensions();
  const q = useApiQuery<LeadsDTO>(keys.leads, '/api/leads');
  const [adding, setAdding] = useState(false);
  const [stage, setStage] = useState<string>('all');
  const [search, setSearch] = useState('');
  const items = q.data?.items ?? [];
  const colWidth = Math.min(280, Math.max(240, width * 0.72));
  /** Phones get a stage filter + one list; wide screens get the board. */
  const board = width >= 900;

  const columns: { key: string; label: string; tone: string; leads: LeadListItem[] }[] = [
    ...LEAD_PIPELINE.map((s) => ({
      key: s,
      label: LEAD_STATUS_LABELS[s],
      tone: COLUMN_TONE[s] ?? colors.gold,
      leads: items.filter((l) => l.status === s),
    })),
    { key: 'other', label: 'בהמתנה / לא רלוונטי', tone: colors.inkMuted, leads: items.filter((l) => OTHER.includes(l.status)) },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="eyebrow" color={colors.gold}>
              CRM
            </Text>
            <Text variant="h1">לקוחות ופניות</Text>
            <Text variant="bodySmall" color={colors.inkSoft}>
              כל לקוח בשלב שלו, עם כל המידע במקום אחד.
            </Text>
          </View>
          <Button label="לקוח חדש" icon="plus" size="sm" onPress={() => setAdding(true)} />
        </View>

        <View style={styles.summary}>
          <Summary label="פניות פתוחות" value={items.filter((l) => ['new', 'contacted', 'meeting', 'proposal'].includes(l.status)).length} />
          <Summary label="נסגרו" value={items.filter((l) => l.status === 'booked').length} />
          <Summary
            label="שווי בצנרת"
            text={formatAgorot(
              items.filter((l) => ['contacted', 'meeting', 'proposal'].includes(l.status)).reduce((a, l) => a + (l.quotedPriceAgorot ?? 0), 0),
            )}
          />
        </View>

        {q.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
        ) : !board ? (
          <View style={{ gap: space.md }}>
            <View style={{ paddingHorizontal: space.lg }}>
              <View style={styles.search}>
                <Feather name="search" size={16} color={colors.gold} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="חיפוש לקוח"
                  placeholderTextColor={colors.inkMuted}
                  style={[styles.searchInput, { textAlign: textStart }, { outlineStyle: 'none' } as object]}
                  accessibilityLabel="חיפוש לקוח"
                />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
              <Chip label={`הכל · ${items.length}`} selected={stage === 'all'} onPress={() => setStage('all')} />
              {columns.map((c) => (
                <Chip key={c.key} label={`${c.label} · ${c.leads.length}`} selected={stage === c.key} onPress={() => setStage(c.key)} />
              ))}
            </ScrollView>
            <View style={{ gap: space.sm, paddingHorizontal: space.lg }}>
              {(() => {
                const term = search.trim();
                const base = stage === 'all' ? items : (columns.find((c) => c.key === stage)?.leads ?? []);
                const list = term ? base.filter((l) => l.clientName.includes(term)) : base;
                if (!list.length) {
                  return (
                    <View style={styles.emptyCol}>
                      <Text variant="bodySmall" color={colors.inkMuted}>
                        {term ? 'לא נמצאו לקוחות.' : 'אין לקוחות בשלב הזה.'}
                      </Text>
                    </View>
                  );
                }
                return list.map((l, i) => (
                  <Reveal key={l.id} index={Math.min(i, 8)}>
                    <LeadCard lead={l} accent={COLUMN_TONE[l.status] ?? colors.gold} showStatus={stage === 'all'} />
                  </Reveal>
                ));
              })()}
            </View>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm }}>
            {columns.map((c, ci) => (
              <Reveal key={c.key} index={ci} style={[styles.column, { width: colWidth }]}>
                <View style={styles.colHead}>
                  <View style={[styles.colDot, { backgroundColor: c.tone }]} />
                  <Text variant="label" style={{ flex: 1 }}>
                    {c.label}
                  </Text>
                  <View style={styles.count}>
                    <Text variant="caption" color={colors.inkSoft} style={{ fontFamily: fonts.bodyMedium }}>
                      {c.leads.length}
                    </Text>
                  </View>
                </View>
                {c.leads.length ? (
                  c.leads.map((l) => <LeadCard key={l.id} lead={l} accent={c.tone} />)
                ) : (
                  <View style={styles.emptyCol}>
                    <Text variant="caption" color={colors.inkMuted}>
                      אין לקוחות בשלב הזה
                    </Text>
                  </View>
                )}
              </Reveal>
            ))}
          </ScrollView>
        )}
      </ScrollView>

      <AddLeadSheet visible={adding} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

function Summary({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.summaryNum}>{text ?? String(value ?? 0)}</Text>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
    </View>
  );
}

function LeadCard({ lead: l, accent, showStatus }: { lead: LeadListItem; accent: string; showStatus?: boolean }) {
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: l.id } })}
      style={[styles.card, { borderTopColor: accent }]}>
      <View style={styles.cardTop}>
        <Text variant="h3" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.displayMedium, fontSize: 18 }}>
          {l.clientName}
        </Text>
        {showStatus ? (
          <View style={[styles.statusPill, { backgroundColor: `${accent}1A` }]}>
            <Text variant="caption" color={accent} style={{ fontFamily: fonts.bodyMedium, fontSize: 11 }}>
              {LEAD_STATUS_LABELS[l.status]}
            </Text>
          </View>
        ) : null}
        {l.unread ? (
          <View style={styles.unread}>
            <Feather name="message-circle" size={11} color={colors.inverse} />
            <Text variant="caption" color={colors.inverse} style={{ fontSize: 10 }}>
              {l.unread}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
        {[l.eventDate ? formatDayDots(l.eventDate) : 'ללא תאריך', l.guestCount ? `${l.guestCount} מוזמנים` : null, l.source === 'app' ? 'דרך SOON' : 'ידני']
          .filter(Boolean)
          .join(' · ')}
      </Text>
      <View style={styles.cardBottom}>
        <Text variant="label" color={colors.ink}>
          {l.quotedPriceAgorot ? formatAgorot(l.quotedPriceAgorot) : '—'}
        </Text>
        {l.nextAction ? (
          <View style={styles.next}>
            <Feather name="clock" size={11} color={colors.gold} />
            <Text variant="caption" color={colors.inkSoft} numberOfLines={1} style={{ maxWidth: 130 }}>
              {l.nextAction}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function AddLeadSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<'soon' | 'outside'>('soon');
  const [linking, setLinking] = useState(false);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string>();
  const create = useApiMutation({ invalidate: [keys.leads, keys.dashboard] });

  function save() {
    setError(undefined);
    create.mutate(
      {
        path: '/api/leads',
        json: { clientName: name.trim(), clientPhone: phone.trim() || null, eventDate: date, quotedPrice: shekelsToAgorot(price) },
      },
      {
        onSuccess: () => {
          setName('');
          setPhone('');
          setDate(null);
          setPrice('');
          onClose();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  async function addCouple(c: CoupleSearchItem) {
    setError(undefined);
    setLinking(true);
    try {
      const { leadId } = await api<{ leadId: string }>('/api/leads/from-wedding', { method: 'POST', json: { weddingId: c.weddingId } });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.leads }), qc.invalidateQueries({ queryKey: keys.dashboard })]);
      onClose();
      router.push({ pathname: '/vendor/lead/[id]', params: { id: leadId } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLinking(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="CRM"
      title="לקוח חדש"
      footer={
        mode === 'outside' ? <Button label="שמירה" style={{ flex: 1 }} loading={create.isPending} disabled={!name.trim()} onPress={save} /> : undefined
      }>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Chip label="זוג מ־SOON" selected={mode === 'soon'} onPress={() => setMode('soon')} />
        <Chip label="לקוח חיצוני" selected={mode === 'outside'} onPress={() => setMode('outside')} />
      </View>
      {mode === 'soon' ? (
        <>
          <CoupleSearch onPick={(c) => void addCouple(c)} />
          {linking ? <ActivityIndicator color={colors.accent} /> : null}
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <TextField label="שם הלקוח / הזוג" value={name} onChangeText={setName} />
          <TextField label="טלפון" ltr keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <DateField label="תאריך האירוע" value={date} onChange={setDate} clearable />
          <TextField label="הצעת מחיר (₪)" ltr keyboardType="number-pad" value={price} onChangeText={setPrice} error={error} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, padding: space.lg, paddingBottom: space.md, marginTop: space.md },
  summary: {
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.offWhite,
  },
  summaryNum: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  column: { gap: space.sm, padding: space.sm, borderRadius: radius.lg, backgroundColor: colors.offWhite, alignSelf: 'flex-start' },
  colHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: 6 },
  colDot: { width: 8, height: 8, borderRadius: 4 },
  count: { minWidth: 24, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  card: {
    gap: 6,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderTopWidth: 3,
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: 2 },
  unread: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accent },
  next: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  emptyCol: { paddingVertical: space.lg, alignItems: 'center' },
});
