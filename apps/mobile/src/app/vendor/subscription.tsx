import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { effectivePlan, formatAgorot, PLANS, type PlanKey, type VendorBillingDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { SectionTitle } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { useVendor } from '@/lib/vendor-context';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const BILLING_KEY = ['billing'] as const;

const go = (url: string) => (Platform.OS === 'web' ? (window.location.href = url) : Linking.openURL(url));

/**
 * App subscription: the free first month, the plan and what it includes, the saved card for the
 * monthly charge, and the charge history.
 */
export default function Subscription() {
  const { card: cardReturn, paid: paidReturn } = useLocalSearchParams<{ card?: string; paid?: string }>();
  const qc = useQueryClient();
  const { reload } = useVendor();
  const q = useApiQuery<VendorBillingDTO>(BILLING_KEY, '/api/vendors/me/billing', {
    // Right after the card page the provider's notification may still be on its way.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (cardReturn && !d?.card) return 3000;
      if (paidReturn && d && !d.charges.some((c) => c.id === paidReturn && c.status !== 'pending')) return 3000;
      return false;
    },
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (cardReturn && q.data?.card) notify('הכרטיס נשמר', `${q.data.card.brand ?? 'כרטיס'} ••••${q.data.card.last4 ?? ''}`);
  }, [cardReturn, q.data?.card]);

  if (q.isPending || !q.data) return <Loading />;
  const b = q.data;
  const returned = paidReturn ? b.charges.find((c) => c.id === paidReturn) : undefined;
  const daysLeft = b.planActiveUntil ? Math.ceil((new Date(b.planActiveUntil).getTime() - now) / 86_400_000) : null;
  const active = effectivePlan(b.plan, b.planActiveUntil);
  const current = PLANS.find((p) => p.key === b.plan)!;
  const inTrial = b.plan !== 'basic' && b.planActiveUntil && !b.charges.some((c) => c.status === 'paid');
  const lapsed = b.plan !== 'basic' && active === 'basic';

  async function saveCard() {
    setBusy('card');
    try {
      const { url } = await api<{ url: string }>('/api/vendors/me/billing/card', { method: 'POST' });
      await go(url);
    } catch (err) {
      notify('לא הצלחנו לפתוח את דף הכרטיס', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  /** Pay one month of `plan` on the payment page (when cards can't be saved). */
  async function payMonth(plan?: PlanKey) {
    setBusy(plan ?? 'pay');
    try {
      const { url } = await api<{ url: string }>('/api/vendors/me/billing/pay', { method: 'POST', json: plan ? { plan } : {} });
      await go(url);
    } catch (err) {
      notify('לא הצלחנו לפתוח את דף התשלום', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function change(key: PlanKey) {
    const target = PLANS.find((p) => p.key === key)!;
    const msg = target.priceMonthly
      ? `לעבור למסלול ${target.name} (₪${target.priceMonthly} לחודש)?${b.planActiveUntil && new Date(b.planActiveUntil) > new Date() ? ` החיוב הבא ב־${formatDate(b.planActiveUntil)}.` : ' החיוב מתבצע עכשיו.'}`
      : 'לעבור למסלול Basic החינמי? ההטבות של המסלול הנוכחי יפסיקו.';
    if (!(await confirm('שינוי מסלול', msg, 'אישור'))) return;
    setBusy(key);
    try {
      const next = await api<VendorBillingDTO>('/api/vendors/me/plan', { method: 'PUT', json: { plan: key } });
      qc.setQueryData(BILLING_KEY, next);
      await Promise.all([qc.invalidateQueries({ queryKey: keys.account }), reload()]);
      notify('המסלול עודכן', `המסלול שלכם עכשיו ${target.name}.`);
    } catch (err) {
      if (err instanceof ApiError && err.data.needsPayment) {
        if (await confirm('תשלום על החודש הראשון', `המסלול ${target.name} יופעל מיד אחרי התשלום (₪${target.priceMonthly}).`, 'לתשלום')) await payMonth(key);
      } else if (err instanceof ApiError && err.data.needsCard) {
        if (await confirm('צריך כרטיס אשראי', 'כדי לשדרג, שמרו כרטיס אשראי. החיוב החודשי יתבצע ממנו.', 'שמירת כרטיס')) await saveCard();
      } else notify('שינוי המסלול נכשל', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen back backTo="/vendor/business" title="מנוי האפליקציה">
      <View style={styles.current}>
        <Text variant="eyebrow" color="rgba(255,255,255,0.6)">
          המסלול שלכם
        </Text>
        <Text style={styles.currentName}>{current.name}</Text>
        <Text variant="bodySmall" color="rgba(255,255,255,0.85)">
          {inTrial && b.planActiveUntil
            ? `חודש חינם עד ${formatDate(b.planActiveUntil)} · אחר כך ₪${current.priceMonthly} לחודש`
            : lapsed
              ? 'התקופה הסתיימה: פעילים כרגע בהטבות Basic'
              : current.priceMonthly && b.planActiveUntil
                ? `₪${current.priceMonthly} לחודש · החיוב הבא ${formatDate(b.planActiveUntil)}`
                : 'ללא עלות'}
        </Text>
        {!b.paymentsLive ? (
          <Text variant="caption" color={colors.goldLight}>
            מצב בדיקה: חיובים לא מתבצעים באמת עד חיבור הסליקה.
          </Text>
        ) : null}
      </View>

      {returned ? (
        <View style={[styles.notice, returned.status === 'failed' && { backgroundColor: colors.dangerSoft }]}>
          <Feather name={returned.status === 'paid' ? 'check-circle' : returned.status === 'failed' ? 'x-circle' : 'clock'} size={18} color={colors.accent} />
          <Text variant="bodySmall" style={{ flex: 1 }}>
            {returned.status === 'paid' ? 'התשלום התקבל. תודה!' : returned.status === 'failed' ? 'התשלום לא הושלם.' : 'מאשרים את התשלום…'}
          </Text>
        </View>
      ) : null}

      {b.canSaveCard ? (
        <View style={styles.cardRow}>
        <Feather name="credit-card" size={20} color={colors.gold} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" style={{ fontFamily: fonts.bodyMedium }}>
            {b.card ? `${b.card.brand ?? 'כרטיס'} ••••${b.card.last4 ?? ''}` : 'אין כרטיס שמור'}
          </Text>
          <Text variant="caption" color={colors.inkMuted}>
            {b.card ? `תוקף ${b.card.expiry ?? '—'} · משמש לחיוב החודשי` : 'נדרש כדי להמשיך במסלול בתשלום אחרי החודש החינמי'}
          </Text>
        </View>
        <Button size="sm" variant={b.card ? 'ghost' : 'primary'} label={b.card ? 'החלפה' : 'שמירת כרטיס'} loading={busy === 'card'} onPress={saveCard} />
      </View>

      ) : b.plan !== 'basic' ? (
        <View style={styles.cardRow}>
          <Feather name="credit-card" size={20} color={colors.gold} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="label" style={{ fontFamily: fonts.bodyMedium }}>
              {lapsed ? 'התקופה הסתיימה' : daysLeft != null ? `עוד ${Math.max(daysLeft, 0)} ימים בתקופה הנוכחית` : 'תשלום חודשי'}
            </Text>
            <Text variant="caption" color={colors.inkMuted}>
              {`תשלום לחודש נוסף (₪${current.priceMonthly}) בדף התשלום המאובטח. החודש מתווסף לסוף התקופה.`}
            </Text>
          </View>
          <Button size="sm" variant={lapsed || (daysLeft ?? 99) <= 7 ? 'primary' : 'ghost'} label="תשלום לחודש" loading={busy === 'pay'} onPress={() => payMonth()} />
        </View>
      ) : null}

      <SectionTitle>המסלולים</SectionTitle>
      {PLANS.map((p) => {
        const on = p.key === b.plan;
        return (
          <View key={p.key} style={[styles.plan, on && styles.planOn]}>
            <View style={styles.planHead}>
              <View style={{ flex: 1 }}>
                <Text variant="h2">{p.name}</Text>
                <Text variant="bodySmall" color={colors.inkSoft}>
                  {p.tagline}
                </Text>
              </View>
              <Text style={styles.price}>{p.priceMonthly ? `₪${p.priceMonthly}` : 'חינם'}</Text>
            </View>
            {p.features.map((f) => (
              <View key={f} style={styles.feature}>
                <Feather name="check" size={14} color={on ? colors.accent : colors.gold} />
                <Text variant="bodySmall" style={{ flex: 1 }}>
                  {f}
                </Text>
              </View>
            ))}
            {on ? (
              <Text variant="label" color={colors.accent}>
                המסלול הנוכחי
              </Text>
            ) : (
              <Button variant={p.priceMonthly > current.priceMonthly ? 'primary' : 'outline'} label={`מעבר ל־${p.name}`} loading={busy === p.key} onPress={() => change(p.key)} />
            )}
          </View>
        );
      })}

      {b.charges.length ? (
        <>
          <SectionTitle>חיובים</SectionTitle>
          {b.charges.map((c) => (
            <View key={c.id} style={styles.charge}>
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {`${formatDate(c.createdAt)} · ${PLANS.find((p) => p.key === c.plan)?.name ?? c.plan}`}
              </Text>
              <Text variant="label" color={c.status === 'paid' ? colors.success : colors.danger}>
                {c.status === 'paid' ? formatAgorot(c.amountAgorot) : (c.error ?? 'נכשל')}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  current: { gap: 4, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.night, ...shadow.md },
  currentName: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.inverse },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  plan: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent', ...shadow.sm },
  planOn: { borderColor: colors.accent },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  price: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  charge: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
});
