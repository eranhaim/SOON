import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { agorotToShekelsInput, shekelsToAgorot, weddingUpdateSchema, type WeddingDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { BudgetCategoryFields, NamesFields, WhenWhereFields, type WeddingFormState } from '@/components/WeddingForm';
import { ListRow, SectionTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { keys } from '@/lib/query';
import { useSessionUser } from '@/lib/session';
import { useOwnWedding } from '@/lib/wedding';
import { colors, space } from '@/theme/tokens';

/** Update date, region, budget and categories any time (spec §3). */
export default function Profile() {
  const w = useOwnWedding();
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const [form, setForm] = useState<WeddingFormState>(() => ({
    partner1Name: w.partner1Name,
    partner2Name: w.partner2Name,
    phone: '',
    weddingDate: w.weddingDate,
    region: w.region,
    venueName: w.venueName ?? '',
    budget: agorotToShekelsInput(w.budgetTotalAgorot),
    closed: w.categories.filter((c) => c.status === 'closed').map((c) => c.slug),
    needed: w.categories.filter((c) => c.status === 'needed').map((c) => c.slug),
  }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const set = (patch: Partial<WeddingFormState>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setMsg(undefined);
    const parsed = weddingUpdateSchema.safeParse({
      partner1Name: form.partner1Name,
      partner2Name: form.partner2Name,
      weddingDate: form.weddingDate,
      region: form.region,
      venueName: form.venueName.trim() || null,
      budgetTotal: shekelsToAgorot(form.budget),
      closedCategories: form.closed,
      neededCategories: form.needed,
    });
    if (!parsed.success) return setMsg({ ok: false, text: 'בדקו את הפרטים' });
    setBusy(true);
    try {
      const wedding = await api<WeddingDTO>('/api/weddings/me', { method: 'PATCH', json: parsed.data });
      qc.setQueryData(keys.wedding, { wedding });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.home }), qc.invalidateQueries({ queryKey: keys.planning })]);
      setMsg({ ok: true, text: 'נשמר' });
    } catch (err) {
      setMsg({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="הפרופיל שלנו" subtitle={user?.email}>
      <SectionTitle>פרטי החתונה</SectionTitle>
      <NamesFields form={form} set={set} />
      <WhenWhereFields form={form} set={set} />
      <SectionTitle>תקציב וספקים</SectionTitle>
      <BudgetCategoryFields form={form} set={set} />
      {msg ? (
        <Text variant="bodySmall" color={msg.ok ? colors.inkSoft : colors.danger}>
          {msg.text}
        </Text>
      ) : null}
      <Button label="שמירה" loading={busy} onPress={save} />
      <View style={{ marginTop: space.lg }}>
        <ListRow
          icon="log-out"
          label="התנתקות"
          trailing={<View />}
          onPress={async () => {
            await authClient.signOut();
            qc.clear();
            router.replace('/choose-role');
          }}
        />
      </View>
    </Screen>
  );
}
