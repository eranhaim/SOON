import { useState } from 'react';
import { View } from 'react-native';

import { vendorFaqInputSchema, type VendorFaqDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, IconButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

type Draft = { id?: string; question: string; answer: string };

const SUGGESTIONS = ['האם אתם נוסעים לכל הארץ?', 'כמה זמן מראש כדאי להזמין?', 'מה כלול במחיר?', 'האם יש תוספת על נסיעות?'];

/** FAQ (spec §5: travel, national coverage, recommended booking time…). */
export default function Faq() {
  const { vendor, mutate } = useOwnVendor();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    if (!draft) return;
    const parsed = vendorFaqInputSchema.safeParse(draft);
    if (!parsed.success) return setError('נא למלא שאלה ותשובה');
    setBusy(true);
    try {
      await mutate(draft.id ? `/api/vendors/me/faqs/${draft.id}` : '/api/vendors/me/faqs', {
        method: draft.id ? 'PUT' : 'POST',
        json: parsed.data,
      });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(f: VendorFaqDTO) {
    if (!(await confirm('מחיקת שאלה', 'למחוק את השאלה?', 'מחיקה'))) return;
    try {
      await mutate(`/api/vendors/me/faqs/${f.id}`, { method: 'DELETE' });
    } catch (err) {
      notify('המחיקה נכשלה', errorMessage(err));
    }
  }

  const unused = SUGGESTIONS.filter((s) => !vendor.faqs.some((f) => f.question === s));

  return (
    <Screen title="שאלות נפוצות" back backTo="/vendor/business">
      {draft ? (
        <Card tone="muted">
          <TextField label="שאלה" value={draft.question} onChangeText={(question) => setDraft({ ...draft, question })} autoFocus={!draft.question} />
          <TextField
            label="תשובה"
            multiline
            style={{ minHeight: 100, textAlignVertical: 'top' }}
            value={draft.answer}
            onChangeText={(answer) => setDraft({ ...draft, answer })}
            autoFocus={Boolean(draft.question) && !draft.answer}
          />
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button variant="ghost" label="ביטול" onPress={() => setDraft(null)} style={{ flex: 1 }} />
            <Button label="שמירה" loading={busy} onPress={save} style={{ flex: 2 }} />
          </View>
        </Card>
      ) : (
        <>
          <Button variant="outline" label="+ הוספת שאלה" onPress={() => setDraft({ question: '', answer: '' })} />
          {unused.length ? (
            <View style={{ gap: space.xs }}>
              <Text variant="caption" color={colors.inkMuted}>
                שאלות שזוגות שואלים הרבה:
              </Text>
              {unused.map((q) => (
                <Button key={q} variant="ghost" label={`+ ${q}`} onPress={() => setDraft({ question: q, answer: '' })} style={{ alignItems: 'flex-start', minHeight: 36 }} />
              ))}
            </View>
          ) : null}
        </>
      )}

      {vendor.faqs.map((f) => (
        <Card key={f.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <Text variant="body" style={{ flex: 1, fontFamily: 'Heebo_500Medium' }}>
              {f.question}
            </Text>
            <IconButton
              icon="edit-2"
              label="עריכה"
              onPress={() => {
                setError(undefined);
                setDraft({ id: f.id, question: f.question, answer: f.answer });
              }}
            />
            <IconButton icon="trash-2" label="מחיקה" onPress={() => remove(f)} />
          </View>
          <Text variant="bodySmall" color={colors.inkSoft}>
            {f.answer}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
