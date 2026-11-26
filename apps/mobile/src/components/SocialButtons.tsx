import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { UserRole } from '@soon/shared';

import { notify } from '@/lib/confirm';
import { queryClient } from '@/lib/query';
import {
  linkedAccountsKey,
  linkErrorText,
  linkGoogle,
  signInWith,
  socialErrorText,
  useAuthProviders,
  useLinkedAccounts,
  type Provider,
} from '@/lib/social';
import { colors, hairline, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { PressableScale } from './motion';
import { Text } from './Text';
import { ListRow } from './ui';

/** Google's four-color "G" (brand guidelines: the mark is never recolored). */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const LABEL: Record<Provider, string> = { google: 'המשך עם Google', apple: 'המשך עם Apple' };

/**
 * One button per provider that has keys on the server; nothing when none do. `divider` adds
 * the "או" line under the buttons (for screens that continue with the email form).
 */
export function SocialButtons({
  role,
  next,
  divider = false,
  onError,
}: {
  role?: UserRole;
  next?: string | null;
  divider?: boolean;
  onError: (text: string | undefined) => void;
}) {
  const providers = useAuthProviders();
  const [busy, setBusy] = useState<Provider | null>(null);
  if (!providers.length) return null;

  async function press(p: Provider) {
    onError(undefined);
    setBusy(p);
    const error = await signInWith(p, { role, next });
    // On success the page / app leaves for the provider; only failures come back here.
    setBusy(null);
    if (error) onError(socialErrorText('failed'));
  }

  return (
    <View style={styles.stack}>
      {providers.map((p) => (
        <PressableScale
          key={p}
          accessibilityRole="button"
          accessibilityLabel={LABEL[p]}
          accessibilityState={{ busy: busy === p }}
          disabled={busy != null}
          onPress={() => press(p)}
          style={[styles.button, p === 'apple' && styles.apple]}>
          {busy === p ? (
            <ActivityIndicator color={p === 'apple' ? colors.inverse : colors.ink} />
          ) : (
            <View style={styles.inner}>
              {p === 'google' ? <GoogleMark /> : null}
              <Text variant="label" color={p === 'apple' ? colors.inverse : colors.ink}>
                {LABEL[p]}
              </Text>
            </View>
          )}
        </PressableScale>
      ))}
      {divider ? (
        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text variant="caption" color={colors.inkMuted}>
            או
          </Text>
          <View style={styles.rule} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * "Google account" row for settings: connects Google to an email account, so the user can
 * sign in with either. Hidden when the server has no Google keys.
 */
export function GoogleLinkRow({ path }: { path: string }) {
  const providers = useAuthProviders();
  const accounts = useLinkedAccounts();
  const params = useLocalSearchParams<{ linked?: string; error?: string }>();
  const [busy, setBusy] = useState(false);

  // Coming back from Google: say how it went once, then clean the address.
  useEffect(() => {
    if (params.linked === 'google') {
      notify('Google חובר', 'מעכשיו אפשר להיכנס גם עם Google.');
      void queryClient.invalidateQueries({ queryKey: linkedAccountsKey });
    } else if (params.error) {
      notify('החיבור ל־Google נכשל', linkErrorText(params.error), 'error');
    } else return;
    router.setParams({ linked: undefined, error: undefined });
  }, [params.linked, params.error]);

  if (!providers.includes('google') || !accounts.data) return null;
  const linked = accounts.data.includes('google');

  return (
    <ListRow
      leading={
        <View style={styles.markBadge}>
          <GoogleMark size={18} />
        </View>
      }
      label="חשבון Google"
      hint={linked ? 'מחובר. אפשר להיכנס גם עם Google.' : 'חברו כדי להיכנס בלחיצה אחת, בלי סיסמה.'}
      trailing={
        linked ? (
          <Feather name="check-circle" size={20} color={colors.success} />
        ) : (
          <Button
            size="sm"
            variant="outline"
            label="חיבור"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              const error = await linkGoogle(path);
              setBusy(false);
              if (error) notify('החיבור ל־Google נכשל', 'נסו שוב בעוד רגע.', 'error');
            }}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  markBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.line,
  },
  stack: { gap: space.md },
  button: {
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
  },
  apple: { backgroundColor: colors.night, borderColor: colors.night },
  inner: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  rule: { flex: 1, height: hairline, backgroundColor: colors.line },
});
