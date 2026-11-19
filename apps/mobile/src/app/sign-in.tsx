import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { USER_ROLES, type UserRole } from '@soon/shared';

import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { homeForRole } from '@/lib/session';
import { Logo } from '@/components/Logo';
import { Reveal } from '@/components/motion';
import { colors, corners, fonts, hairline, PHOTOS, space } from '@/theme/tokens';

const TOO_MANY = 'יותר מדי ניסיונות. נסו שוב בעוד דקה.';
/** Must match emailAndPassword.minPasswordLength in apps/server/src/auth.ts. */
const MIN_PASSWORD = 6;

type Provider = 'google' | 'apple';
const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'המשך עם Google',
  apple: 'המשך עם Apple',
};

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = USER_ROLES.includes(params.role as UserRole) ? (params.role as UserRole) : undefined;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const canSubmit =
    email.includes('@') && password.length >= MIN_PASSWORD && (mode === 'signin' || name.trim().length > 0);

  async function submit() {
    if (!canSubmit || busy) return;
    setError(undefined);
    setBusy(true);
    const { error: err } =
      mode === 'signin'
        ? await authClient.signIn.email({ email: email.trim(), password })
        : await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
    setBusy(false);
    if (err) {
      if (err.status === 429) return setError(TOO_MANY);
      if (mode === 'signin') return setError('האימייל או הסיסמה שגויים.');
      if (err.code === 'USER_ALREADY_EXISTS' || err.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        return setError('כבר קיים חשבון עם האימייל הזה. נסו להתחבר.');
      }
      return setError('לא הצלחנו ליצור חשבון. בדקו את הפרטים.');
    }
    await finish();
  }

  function switchMode() {
    setError(undefined);
    setMode(mode === 'signin' ? 'signup' : 'signin');
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
    <View style={styles.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            <Image
              source={role === 'vendor' ? PHOTOS.heroTable : PHOTOS.heroCouple}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={400}
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.1)', 'rgba(255,255,255,1)']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView edges={['top']} style={styles.bannerTop}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="חזרה"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/choose-role'))}
                style={styles.back}>
                <Feather name="chevron-right" size={22} color={colors.ink} />
              </Pressable>
              <Logo size={22} color={colors.inverse} />
              <View style={{ width: 40 }} />
            </SafeAreaView>
          </View>
          <View style={styles.content}>
          <Reveal>
            <Text variant="eyebrow" color={colors.gold}>
              {role === 'vendor' ? 'לעסקים' : 'לזוגות'}
            </Text>
            <Text variant="h1">{mode === 'signin' ? 'שמחים לראות אתכם' : 'נעים להכיר'}</Text>
            <Text variant="body" color={colors.inkSoft} style={styles.lead}>
              {mode === 'signin' ? 'התחברו לחשבון שלכם' : 'צרו חשבון חדש בכמה שניות'}
            </Text>
          </Reveal>

          {providers.length > 0 && (
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

          <View style={styles.stack}>
            {mode === 'signup' && (
              <TextField label="שם מלא" value={name} onChangeText={setName} autoComplete="name" />
            )}
            <TextField
              label="אימייל"
              ltr
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <TextField
              label={mode === 'signup' ? `סיסמה (לפחות ${MIN_PASSWORD} תווים)` : 'סיסמה'}
              ltr
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              error={error}
              onSubmitEditing={submit}
            />
            <Button
              label={mode === 'signin' ? 'כניסה' : 'יצירת חשבון'}
              loading={busy}
              disabled={!canSubmit}
              onPress={submit}
            />
            <Button
              variant="ghost"
              label={mode === 'signin' ? 'אין לכם חשבון? הרשמה' : 'כבר יש לכם חשבון? כניסה'}
              onPress={switchMode}
            />
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  banner: { height: 260, overflow: 'hidden' },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.md },
  back: { width: 40, height: 40, borderRadius: corners.iconButton, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  logo: { fontFamily: fonts.displayLight, fontSize: 24, letterSpacing: 8, writingDirection: 'ltr' },
  content: { padding: space.lg, paddingTop: 0, marginTop: -space.lg, gap: space.sm, maxWidth: 480, width: '100%', alignSelf: 'center' },
  lead: { marginBottom: space.lg },
  stack: { gap: space.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginVertical: space.lg },
  rule: { flex: 1, height: hairline, backgroundColor: colors.line },
});
