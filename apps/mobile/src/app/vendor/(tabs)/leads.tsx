import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatAgorot, LEAD_PIPELINE, LEAD_STATUS_LABELS, shekelsToAgorot, type LeadListItem, type LeadsDTO, type LeadStatus } from '@soon/shared';

import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { PressableScale, Reveal } from '@/components/motion';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/api';
import { formatDayDots } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

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
  const items = q.data?.items ?? [];
  const colWidth = Math.min(280, Math.max(240, width * 0.72));

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
          <Button label="ליד" icon="plus" size="sm" onPress={() => setAdding(true)} />
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

function LeadCard({ lead: l, accent }: { lead: LeadListItem; accent: string }) {
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: l.id } })}
      style={[styles.card, { borderTopColor: accent }]}>
      <View style={styles.cardTop}>
        <Text variant="h3" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.displayMedium, fontSize: 18 }}>
          {l.clientName}
        </Text>
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

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="CRM"
      title="ליד חדש"
      footer={<Button label="שמירה" style={{ flex: 1 }} loading={create.isPending} disabled={!name.trim()} onPress={save} />}>
      <TextField label="שם הלקוח / הזוג" value={name} onChangeText={setName} />
      <TextField label="טלפון" ltr keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <DateField label="תאריך האירוע" value={date} onChange={setDate} clearable />
      <TextField label="הצעת מחיר (₪)" ltr keyboardType="number-pad" value={price} onChangeText={setPrice} error={error} />
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
  emptyCol: { paddingVertical: space.lg, alignItems: 'center' },
});
