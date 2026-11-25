import { useState } from 'react';
import { View } from 'react-native';

import type { AppSettingsDTO } from '@soon/shared';

import { AdminNav } from '@/components/AdminNav';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, SectionTitle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

const KEY = ['admin-settings'];

/** Platform settings: the service fee on gifts (SOON's revenue on the wedding site). */
export default function AdminSettings() {
  const q = useApiQuery<AppSettingsDTO>(KEY, '/api/admin/settings');
  const m = useApiMutation<AppSettingsDTO>({ setData: KEY });
  const [pct, setPct] = useState<string | null>(null);
  const value = pct ?? (q.data ? String(q.data.giftFeeBps / 100) : '');
  const bps = Math.round(Number(value) * 100);
  const valid = Number.isFinite(bps) && bps >= 0 && bps <= 2000;

  return (
    <Screen title="הגדרות" subtitle="הגדרות הפלטפורמה" maxWidth={960}>
      <AdminNav />
      <Card style={{ gap: space.md }}>
        <SectionTitle>עמלה על מתנות</SectionTitle>
        <Text variant="bodySmall" color={colors.inkSoft}>
          דמי השירות שהאורח משלם מעל סכום המתנה. הזוג מקבל את מלוא סכום המתנה.
        </Text>
        <View style={{ maxWidth: 200 }}>
          <TextField label="אחוז (0–20)" ltr keyboardType="decimal-pad" value={value} onChangeText={setPct} />
        </View>
        {valid ? (
          <Text variant="caption" color={colors.inkMuted}>{`לדוגמה: מתנה של ₪500 → האורח משלם ₪${(500 * (1 + bps / 10_000)).toFixed(2)}`}</Text>
        ) : (
          <Text variant="caption" color={colors.danger}>
            ערך בין 0 ל־20
          </Text>
        )}
        <Button
          label="שמירה"
          loading={m.isPending}
          disabled={!valid || pct == null}
          onPress={() =>
            m.mutate(
              { path: '/api/admin/settings', method: 'PUT', json: { giftFeeBps: bps } },
              { onSuccess: () => (setPct(null), notify('נשמר')), onError: (e) => notify('השמירה נכשלה', errorMessage(e)) },
            )
          }
          style={{ alignSelf: 'flex-start' }}
        />
      </Card>
    </Screen>
  );
}
