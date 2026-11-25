import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { faqTemplatesFor, vendorFaqInputSchema, type VendorFaqDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, Chip, ChipGroup, IconButton, SectionTitle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, fonts, space } from '@/theme/tokens';

type Draft = { id?: string; question: string; answer: string };

/**
 * FAQ (spec §5). Ready questions are answered with one tap (multiple choice);
 * vendors can still add their own questions with free text.
 */
export default function Faq() {
  const { vendor, mutate } = useOwnVendor();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const templates = faqTemplatesFor(vendor.categorySlug);
  const answered = new Map(vendor.faqs.filter((f) => f.templateKey).map((f) => [f.templateKey!, f.answer]));
  const custom = vendor.faqs.filter((f) => !f.templateKey);

  async function pick(key: string, option: string) {
    setSaving(key);
    try {
      if (answered.get(key) === option) await mutate(`/api/vendors/me/faqs/template/${key}`, { method: 'DELETE' });
      else await mutate(`/api/vendors/me/faqs/template/${key}`, { method: 'PUT', json: { answer: option } });
    } catch (err) {
      notify('השמירה נכשלה', errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

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

  return (
    <Screen title="שאלות נפוצות" back backTo="/vendor/business">
      <Text variant="bodySmall" color={colors.inkSoft}>
        {`בחרו תשובה אחת לכל שאלה. הזוגות רואים את התשובות בעמוד העסק שלכם. עניתם על ${answered.size} מתוך ${templates.length}.`}
      </Text>

      {templates.map((t, i) => (
        <Reveal key={t.key} index={Math.min(i, 8)}>
          <Card style={{ gap: space.sm }}>
            <View style={styles.qRow}>
              <Text variant="body" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
                {t.question}
              </Text>
              {saving === t.key ? (
                <Text variant="caption" color={colors.inkMuted}>
                  שומרים…
                </Text>
              ) : null}
            </View>
            <ChipGroup>
              {t.options.map((o) => (
                <Chip key={o} label={o} selected={answered.get(t.key) === o} onPress={() => pick(t.key, o)} />
              ))}
            </ChipGroup>
          </Card>
        </Reveal>
      ))}

      <SectionTitle>שאלות משלכם</SectionTitle>
      {draft ? (
        <Card tone="muted">
          <TextField label="שאלה" value={draft.question} onChangeText={(question) => setDraft({ ...draft, question })} autoFocus={!draft.question} />
          <TextField
            label="תשובה"
            multiline
            style={{ minHeight: 100, textAlignVertical: 'top' }}
            value={draft.answer}
            onChangeText={(answer) => setDraft({ ...draft, answer })}
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
        <Button variant="outline" label="+ הוספת שאלה משלכם" onPress={() => setDraft({ question: '', answer: '' })} />
      )}

      {custom.map((f) => (
        <Card key={f.id}>
          <View style={styles.qRow}>
            <Text variant="body" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
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

const styles = StyleSheet.create({
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
