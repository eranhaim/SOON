import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { formatAgorot } from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, errorMessage } from '@/lib/api';
import { colors, radius, shadow, space } from '@/theme/tokens';

/**
 * Test payment page (payments in test mode, before Upay is connected). No card, no money:
 * "pay" or "decline" reports the result to the server like Upay's notification would.
 */
export default function TestPayment() {
  const p = useLocalSearchParams<{ ref: string; sig: string; amount: string; desc: string; ret: string; mode: string }>();
  const [busy, setBusy] = useState<'ok' | 'fail' | null>(null);
  const [error, setError] = useState<string>();
  const amount = Number(p.amount) || 0;
  const card = p.mode === 'card';

  async function finish(ok: boolean) {
    setBusy(ok ? 'ok' : 'fail');
    setError(undefined);
    try {
      await api('/api/payments/test/complete', { method: 'POST', json: { ref: p.ref, sig: p.sig, ok, amount } });
      const back = p.ret ?? '/';
      if (Platform.OS === 'web') window.location.href = back;
      else if (/^https?:/.test(back)) await Linking.openURL(back);
      else router.replace(back as Href);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <Screen maxWidth={480}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Feather name="alert-triangle" size={14} color={colors.accent} />
          <Text variant="caption" color={colors.accent}>
            מצב בדיקה · לא מתבצע חיוב
          </Text>
        </View>
        <Feather name={card ? 'credit-card' : 'lock'} size={30} color={colors.gold} />
        <Text variant="h2" align="center">
          {card ? 'שמירת כרטיס אשראי' : 'תשלום מאובטח'}
        </Text>
        <Text variant="body" color={colors.inkSoft} align="center">
          {p.desc}
        </Text>
        {!card ? (
          <Text variant="h1" align="center">
            {formatAgorot(amount)}
          </Text>
        ) : null}
        <Text variant="caption" color={colors.inkMuted} align="center">
          כשחיבור הסליקה של Upay יופעל, כאן יופיע דף התשלום של Upay.
        </Text>
        {error ? (
          <Text variant="bodySmall" color={colors.danger} align="center">
            {error}
          </Text>
        ) : null}
        <Button label={card ? 'שמירת כרטיס (בדיקה)' : 'תשלום (בדיקה)'} icon="check" loading={busy === 'ok'} disabled={!!busy} onPress={() => finish(true)} style={{ alignSelf: 'stretch' }} />
        <Button label="ביטול" variant="ghost" loading={busy === 'fail'} disabled={!!busy} onPress={() => finish(false)} style={{ alignSelf: 'stretch' }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xxl, alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: radius.xl, backgroundColor: colors.surface, ...shadow.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.accentSoft },
});
