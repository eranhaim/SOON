import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USER_ROLES, type UserRole } from '@soon/shared';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { homeForRole } from '@/lib/session';
import { colors, hairline, space } from '@/theme/tokens';

const TOO_MANY = 'יותר מדי ניסיונות. נסו שוב בעוד דקה.';

type Provider = 'google' | 'apple';
const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'המשך עם Google',
  apple: 'המשך עם Apple',
};

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = USER_ROLES.includes(params.role as UserRole) ? (params.role as UserRole) : undefined;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api<{ authProviders: Provider[] }>('/api/meta')
      .then((m) => setProviders(m.authProviders))
      .catch(() => setProviders([]));
  }, []);

  /** After any successful sign-in: persist the chosen role (first time only), then route by role. */
  async function finish() {
    if (role) {
      await api('/api/me/role', { method: 'POST', json: { role } }).catch(() => undefined);
    }
    const { data } = await authClient.getSession({ query: { disableCookieCache: true } });
    const current = (data?.user as { role?: UserRole | null } | undefined)?.role ?? role ?? null;
    router.replace(homeForRole(current));
  }

  async function sendCode() {
    setError(undefined);
    setBusy(true);
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' });
    setBusy(false);
    if (err) return setError(err.status === 429 ? TOO_MANY : 'לא הצלחנו לשלוח קוד. בדקו את כתובת האימייל.');
    setStep('code');
  }

  async function verifyCode() {
    setError(undefined);
    setBusy(true);
    const { error: err } = await authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
    setBusy(false);
    if (err) return setError(err.status === 429 ? TOO_MANY : 'הקוד שגוי או שפג תוקפו.');
    await finish();
  }

  async function social(provider: Provider) {
    setError(undefined);
    const { error: err } = await authClient.signIn.social({
      provider,
      callbackURL: role ? `/home?role=${role}` : '/home',
    });
    if (err) setError('ההתחברות נכשלה. נסו שוב.');
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="h1">{role === 'vendor' ? 'כניסה לעסקים' : 'כניסה'}</Text>
          <Text variant="body" color={colors.inkSoft} style={styles.lead}>
            {step === 'email' ? 'התחברו או צרו חשבון חדש' : `שלחנו קוד בן 6 ספרות אל ${email}`}
          </Text>

          {step === 'email' && providers.length > 0 && (
            <>
              <View style={styles.stack}>
                {providers.map((p) => (
                  <Button key={p} variant="outline" label={PROVIDER_LABEL[p]} onPress={() => social(p)} />
                ))}
              </View>
              <View style={styles.divider}>
                <View style={styles.rule} />
                <Text variant="caption" color={colors.inkMuted}>
                  או
                </Text>
                <View style={styles.rule} />
              </View>
            </>
          )}

          {step === 'email' ? (
            <View style={styles.stack}>
              <TextField
                label="אימייל"
                ltr
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                error={error}
                onSubmitEditing={sendCode}
              />
              <Button label="שלחו לי קוד" loading={busy} disabled={!email.includes('@')} onPress={sendCode} />
            </View>
          ) : (
            <View style={styles.stack}>
              <TextField
                label="קוד אימות"
                ltr
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                error={error}
                onSubmitEditing={verifyCode}
              />
              <Button label="כניסה" loading={busy} disabled={otp.length < 6} onPress={verifyCode} />
              <Button variant="ghost" label="שינוי אימייל" onPress={() => setStep('email')} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, paddingTop: space.xxl, gap: space.sm, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { marginBottom: space.lg },
  stack: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.lg },
  rule: { flex: 1, height: hairline, backgroundColor: colors.line },
});
