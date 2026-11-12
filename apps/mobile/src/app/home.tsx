import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USER_ROLES, type UserRole } from '@soon/shared';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { colors, space } from '@/theme/tokens';

/**
 * Temporary landing screen after sign-in. Week 2–3 replaces this with the couple home
 * (countdown, feed) and the vendor dashboard.
 */
export default function Home() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const params = useLocalSearchParams<{ role?: string }>();
  const role = (session?.user as { role?: UserRole | null } | undefined)?.role;

  // Social sign-in returns here with ?role=… — persist it the first time.
  useEffect(() => {
    const wanted = params.role as UserRole;
    if (session && !role && USER_ROLES.includes(wanted)) {
      api('/api/me/role', { method: 'POST', json: { role: wanted } })
        .then(() => refetch())
        .catch(() => undefined);
    }
  }, [session, role, params.role, refetch]);

  if (isPending) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (!session) return <Redirect href="/choose-role" />;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.content}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 4 }}>
          {role === 'vendor' ? 'BUSINESS' : 'SOON'}
        </Text>
        <Text variant="h1">{role === 'vendor' ? 'בוקר טוב' : 'שלום'}</Text>
        <Text variant="body" color={colors.inkSoft}>
          {session.user.email}
        </Text>
        <Text variant="bodySmall" color={colors.inkMuted}>
          {role === 'vendor'
            ? 'כאן יופיע לוח הבקרה העסקי שלכם.'
            : role === 'couple'
              ? 'כאן יופיעו הספירה לאחור, ההשראה וכלי התכנון שלכם.'
              : 'טוען פרופיל…'}
        </Text>
        <Button
          variant="outline"
          label="התנתקות"
          style={{ marginTop: space.xl }}
          onPress={async () => {
            await authClient.signOut();
            router.replace('/choose-role');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  content: { padding: space.lg, paddingTop: space.xxxl, gap: space.sm, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
