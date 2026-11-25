import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatHebrewDate } from '@soon/shared';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Reveal } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api, errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { colors, radius, shadow, space } from '@/theme/tokens';

type InviteInfo = { valid: boolean; names: string; weddingDate: string | null; inviterName: string | null };

/**
 * Partner invite: /invite/<token>. One partner sends it; the other signs up (or in) and joins
 * the same wedding, so both plan together from one shared wedding.
 */
export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const qc = useQueryClient();
  const { session, role, isPending } = useSessionUser();
  const info = useApiQuery<InviteInfo>(['invite', token], `/api/invites/${encodeURIComponent(token)}`, { retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (info.isPending || isPending) return <Loading />;
  if (info.isError || !info.data) {
    return (
      <Screen title="הקישור לא נמצא" back backTo="/">
        <Text color={colors.inkSoft}>בדקו שהעתקתם את כל הקישור, או בקשו קישור חדש.</Text>
      </Screen>
    );
  }
  const i = info.data;

  async function join() {
    if (!session) {
      router.push({ pathname: '/sign-in', params: { role: 'couple', mode: 'signup', next: `/invite/${token}` } } as unknown as Href);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' });
      await qc.invalidateQueries({ queryKey: keys.wedding });
      router.replace('/couple' as Href);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={520}>
      <Reveal style={styles.card}>
        <Logo variant="symbol" size={44} color={colors.accent} />
        <Text variant="eyebrow" color={colors.gold}>
          הזמנה לתכנון משותף
        </Text>
        <Text variant="h1" align="center">
          {i.names}
        </Text>
        {i.weddingDate ? (
          <Text variant="bodySmall" color={colors.inkSoft} align="center">
            {`${formatDay(i.weddingDate)} · ${formatHebrewDate(i.weddingDate)}`}
          </Text>
        ) : null}
        <Text variant="body" color={colors.inkSoft} align="center">
          {i.inviterName
            ? `${i.inviterName} מזמין/ה אתכם לתכנן יחד את החתונה ב־SOON: אותו תקציב, אותם ספקים, אותה רשימת מוזמנים.`
            : 'הוזמנתם לתכנן יחד את החתונה ב־SOON: אותו תקציב, אותם ספקים, אותה רשימת מוזמנים.'}
        </Text>
        {i.valid ? (
          <>
            <Button label={session ? 'הצטרפות לחתונה' : 'הרשמה והצטרפות'} icon="heart" loading={busy} onPress={join} style={{ alignSelf: 'stretch' }} />
            {session && role && role !== 'couple' ? (
              <Text variant="caption" color={colors.danger} align="center">
                אתם מחוברים עם חשבון ספק. כדי להצטרף, התנתקו והירשמו עם חשבון זוג.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={styles.expired}>
            <Feather name="clock" size={16} color={colors.inkMuted} />
            <Text variant="bodySmall" color={colors.inkSoft} style={{ flex: 1 }}>
              הקישור כבר נוצל או שפג תוקפו. בקשו מבן/בת הזוג לשלוח קישור חדש מהפרופיל.
            </Text>
          </View>
        )}
        {error ? (
          <Text variant="bodySmall" color={colors.danger} align="center">
            {error}
          </Text>
        ) : null}
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: space.xxl,
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.md,
  },
  expired: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.offWhite },
});
