import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import {
  formatAgorot,
  LEAD_PIPELINE,
  LEAD_STATUS_LABELS,
  type LeadDetailDTO,
  type LeadStatus,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/Progress';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, Chip, Divider, SectionTitle } from '@/components/ui';
import { formatDateTime, formatDay } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

const SIDE_EXITS: LeadStatus[] = ['pending', 'lost', 'cancelled'];

/** One client in the CRM (spec §10): stage, event details, payments, next step, chat. */
export default function LeadDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery<LeadDetailDTO>(keys.lead(id), `/api/leads/${id}`);
  const update = useApiMutation<LeadDetailDTO>({ setData: keys.lead(id), invalidate: [keys.leads, keys.dashboard, keys.calendar] });

  if (q.isPending || !q.data) return <Loading />;
  const l = q.data;
  const paid = l.payments.filter((p) => p.paidAt).reduce((a, p) => a + p.amountAgorot, 0);
  const total = l.quotedPriceAgorot ?? 0;
  const stageIndex = LEAD_PIPELINE.indexOf(l.status);

  const setStatus = (status: LeadStatus) => update.mutate({ path: `/api/leads/${id}`, method: 'PATCH', json: { status } });

  return (
    <Screen back backTo="/vendor/leads" title={l.clientName} subtitle={l.source === 'app' ? 'פנייה דרך SOON' : 'ליד שהוזן ידנית'}>
      {/* Stage */}
      <Card>
        <View style={styles.rowBetween}>
          <Text variant="eyebrow" color={colors.gold}>
            שלב
          </Text>
          <Text variant="label" color={colors.accent}>
            {LEAD_STATUS_LABELS[l.status]}
          </Text>
        </View>
        <ProgressBar value={stageIndex >= 0 ? (stageIndex + 1) / LEAD_PIPELINE.length : 0} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {[...LEAD_PIPELINE, ...SIDE_EXITS].map((s) => (
            <Chip key={s} label={LEAD_STATUS_LABELS[s]} selected={l.status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
      </Card>

      {/* Event */}
      <Card>
        <SectionTitle>פרטי האירוע</SectionTitle>
        <Info icon="calendar" label="תאריך" value={l.eventDate ? formatDay(l.eventDate) : 'לא נקבע'} />
        <Info icon="map-pin" label="מקום" value={l.location ?? '—'} />
        <Info icon="users" label="מוזמנים" value={l.guestCount ? String(l.guestCount) : '—'} />
        {l.packageName ? <Info icon="package" label="חבילה" value={l.packageName} /> : null}
        {l.nextAction ? (
          <>
            <Divider />
            <Info icon="clock" label="הצעד הבא" value={`${l.nextAction}${l.nextActionAt ? ` · ${formatDateTime(l.nextActionAt)}` : ''}`} />
          </>
        ) : null}
      </Card>

      {/* Money */}
      <Card>
        <SectionTitle>תשלומים</SectionTitle>
        <View style={styles.money}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.inkSoft}>
              הצעת מחיר
            </Text>
            <Text style={styles.moneyNum}>{total ? formatAgorot(total) : '—'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.inkSoft}>
              שולם
            </Text>
            <Text style={[styles.moneyNum, { color: colors.success }]}>{formatAgorot(paid)}</Text>
          </View>
        </View>
        {total ? <ProgressBar value={paid / total} color={colors.success} /> : null}
        {l.payments.map((p) => (
          <View key={p.id} style={styles.payment}>
            <Feather name={p.paidAt ? 'check-circle' : 'circle'} size={16} color={p.paidAt ? colors.success : colors.stoneDeep} />
            <Text variant="bodySmall" style={{ flex: 1 }}>
              {p.title}
            </Text>
            <Text variant="bodySmall" color={colors.inkSoft}>
              {formatAgorot(p.amountAgorot)}
            </Text>
          </View>
        ))}
      </Card>

      {/* Contact */}
      <Card tone="muted">
        <SectionTitle>יצירת קשר</SectionTitle>
        {l.clientPhone ? <Info icon="phone" label="טלפון" value={l.clientPhone} /> : null}
        {l.clientEmail ? <Info icon="mail" label="אימייל" value={l.clientEmail} /> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {l.conversationId ? (
            <Button
              label="לשיחה"
              icon="message-circle"
              style={{ flex: 1 }}
              onPress={() => router.push({ pathname: '/messages/[id]', params: { id: l.conversationId! } })}
            />
          ) : null}
          {l.clientPhone ? (
            <Button label="חיוג" icon="phone" variant="outline" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${l.clientPhone}`)} />
          ) : null}
        </View>
      </Card>

      {l.notes ? (
        <Card tone="muted">
          <SectionTitle>הערות</SectionTitle>
          <Text variant="bodySmall" color={colors.inkSoft}>
            {l.notes}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function Info({ icon, label, value }: { icon: 'calendar' | 'map-pin' | 'users' | 'package' | 'clock' | 'phone' | 'mail'; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={14} color={colors.gold} />
      </View>
      <Text variant="bodySmall" color={colors.inkSoft} style={{ width: 72 }}>
        {label}
      </Text>
      <Text variant="bodySmall" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  money: { flexDirection: 'row', gap: space.md },
  moneyNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.ink },
  payment: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4, borderRadius: radius.sm },
});
