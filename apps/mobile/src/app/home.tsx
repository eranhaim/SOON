import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { UserRole } from '@soon/shared';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Reveal } from '@/components/motion';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { signOutToStart } from '@/lib/demo';
import { safeNext } from '@/lib/social';
import { colors, space } from '@/theme/tokens';

type Side = Extract<UserRole, 'couple' | 'vendor'>;
const SIDES: Side[] = ['couple', 'vendor'];

/**
 * Landing route after any sign-in (Google / Apple return here with ?role=…&next=…).
 * Saves the role on the first sign-in, then opens `next` or the role's home. A new account
 * without a chosen role picks one here.
 */
export default function Home() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const params = useLocalSearchParams<{ role?: string; next?: string }>();
  const role = (session?.user as { role?: UserRole | null } | undefined)?.role;
  const wanted = SIDES.includes(params.role as Side) ? (params.role as Side) : null;
  const next = safeNext(params.next);
  const [saving, setSaving] = useState<Side | null>(null);
  const [failed, setFailed] = useState(false);

  async function choose(side: Side) {
    setFailed(false);
    setSaving(side);
    try {
      await api('/api/me/role', { method: 'POST', json: { role: side } });
      await refetch();
    } catch {
      setFailed(true);
    } finally {
      setSaving(null);
    }
  }

  // The side chosen before the provider sign-in: save it once.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId || role || !wanted) return;
    let alive = true;
    api('/api/me/role', { method: 'POST', json: { role: wanted } })
      .then(() => refetch())
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [userId, role, wanted, refetch]);

  if (isPending) return <Loading />;
  if (!session) return <Redirect href="/choose-role" />;
  if (role) {
    if (next && role !== 'admin') return <Redirect href={next as Href} />;
    if (role === 'vendor') return <Redirect href="/vendor" />;
    if (role === 'admin') return <Redirect href="/admin" />;
    return <Redirect href="/couple" />;
  }
  if (wanted && !failed) return <Loading />;

  return (
    <SafeAreaView style={styles.root}>
      <Reveal style={styles.content}>
        <Logo size={20} />
        <Text variant="h1" style={{ marginTop: space.lg }}>
          {session.user.name ? `שלום ${session.user.name.split(' ')[0]}` : 'שלום'}
        </Text>
        <Text variant="body" color={colors.inkSoft}>
          איך תשתמשו ב־SOON?
        </Text>
        <View style={styles.choices}>
          <Button label="אנחנו זוג שמתחתן" icon="heart" loading={saving === 'couple'} disabled={saving != null} onPress={() => choose('couple')} />
          <Button label="יש לי עסק לחתונות" variant="outline" icon="briefcase" loading={saving === 'vendor'} disabled={saving != null} onPress={() => choose('vendor')} />
        </View>
        {failed ? (
          <Text variant="caption" color={colors.danger} align="center">
            השמירה לא הצליחה. נסו שוב.
          </Text>
        ) : null}
        <Button variant="ghost" label="התנתקות" onPress={signOutToStart} />
        <Text variant="caption" color={colors.inkMuted} align="center">
          {session.user.email}
        </Text>
      </Reveal>
    </SafeAreaView>
  );
}

function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: space.lg, paddingTop: space.xxxl, gap: space.sm, maxWidth: 480, width: '100%', alignSelf: 'center' },
  choices: { gap: space.md, marginTop: space.lg, marginBottom: space.sm },
});
