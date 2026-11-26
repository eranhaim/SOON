import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { coupleOnboardingSchema, shekelsToAgorot, todayIso, type WeddingDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { BudgetCategoryFields, NamesFields, WhenWhereFields, type WeddingFormState } from '@/components/WeddingForm';
import { api, errorMessage } from '@/lib/api';
import { keys } from '@/lib/query';
import { colors, hairline, space } from '@/theme/tokens';

const STEPS = [
  { title: 'מי מתחתנים?', hint: '' },
  { title: 'מתי ואיפה?', hint: 'אפשר להשאיר ריק ולהשלים אחר כך.' },
  { title: 'תקציב וספקים', hint: 'כך נתאים לכם המלצות ומשימות.' },
];

/** Short questions, complete-later friendly (spec §3). */
export default function CoupleOnboarding() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WeddingFormState>({
    partner1Name: '',
    partner2Name: '',
    phone: '',
    weddingDate: null,
    region: null,
    venueName: '',
    budget: '',
    closed: [],
    needed: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (patch: Partial<WeddingFormState>) => setForm((f) => ({ ...f, ...patch }));

  const canNext = step !== 0 || (form.partner1Name.trim() && form.partner2Name.trim());

  async function finish() {
    setError(undefined);
    const parsed = coupleOnboardingSchema.safeParse({
      partner1Name: form.partner1Name,
      partner2Name: form.partner2Name,
      phone: form.phone.trim() || undefined,
      weddingDate: form.weddingDate ?? undefined,
      region: form.region ?? undefined,
      venueName: form.venueName.trim() || undefined,
      budgetTotal: shekelsToAgorot(form.budget) ?? undefined,
      closedCategories: form.closed,
      neededCategories: form.needed,
    });
    if (!parsed.success) return setError('בדקו את הפרטים שמילאתם');
    setBusy(true);
    try {
      const wedding = await api<WeddingDTO>('/api/weddings', { method: 'POST', json: parsed.data });
      qc.setQueryData(keys.wedding, { wedding });
      router.replace('/couple');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen maxWidth={560}>
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 3 }}>
          {`שלב ${step + 1} מתוך ${STEPS.length}`}
        </Text>
        <View style={styles.progress}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.seg, i <= step && styles.segOn]} />
          ))}
        </View>
      </View>
      <Text variant="h1">{STEPS[step]!.title}</Text>
      {STEPS[step]!.hint ? (
        <Text variant="bodySmall" color={colors.inkSoft}>
          {STEPS[step]!.hint}
        </Text>
      ) : null}

      {step === 0 && <NamesFields form={form} set={set} withPhone />}
      {step === 1 && <WhenWhereFields form={form} set={set} />}
      {step === 2 && <BudgetCategoryFields form={form} set={set} />}

      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        {step > 0 ? <Button variant="ghost" label="הקודם" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < STEPS.length - 1 ? (
          <Button label="המשך" disabled={!canNext} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
        ) : (
          <Button label="בואו נתחיל" loading={busy} onPress={finish} style={{ flex: 2 }} />
        )}
      </View>
      {form.weddingDate && form.weddingDate < todayIso() ? (
        <Text variant="caption" color={colors.inkMuted}>
          התאריך שבחרתם כבר עבר.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: space.xs },
  seg: { flex: 1, height: 2, backgroundColor: colors.line },
  segOn: { backgroundColor: colors.accent },
  footer: { flexDirection: 'row', gap: space.md, marginTop: space.lg, borderTopWidth: hairline, borderTopColor: colors.line, paddingTop: space.lg },
});
