import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { InvitationTemplateDTO } from '@soon/shared';

import { AdminNav } from '@/components/AdminNav';
import { Button } from '@/components/Button';
import { InvitationArt } from '@/components/InvitationArt';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { useApiQuery } from '@/lib/query';
import { pickImages, uploadImage } from '@/lib/upload';
import { colors, radius, shadow, space } from '@/theme/tokens';

type Draft = Omit<InvitationTemplateDTO, 'id'> & { id?: string };
const EMPTY: Draft = { name: '', backgroundUrl: null, paperColor: '#FBF7F1', textColor: '#2B1E1C', accentColor: '#B48A4E', font: 'serif', active: true, sortOrder: 0 };
const KEY = ['admin-templates'];

const SAMPLE = {
  opening: 'בשמחה רבה ובהתרגשות',
  body: 'נשמח לראותכם בין באי השמחה ולחגוג איתכם את היום המאושר בחיינו.',
  closing: 'נשמח לחגוג איתכם',
  partner1Name: 'נועה',
  partner2Name: 'איתי',
  weddingDate: '2027-06-22',
  venueName: 'גן הזית',
};

/** Invitation designs couples choose from: background image, colors, font. */
export default function AdminTemplates() {
  const qc = useQueryClient();
  const list = useApiQuery<InvitationTemplateDTO[]>(KEY, '/api/admin/templates');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function upload() {
    if (!draft) return;
    const [uri] = await pickImages();
    if (!uri) return;
    setBusy('upload');
    try {
      setDraft({ ...draft, backgroundUrl: await uploadImage(uri, 'admin-template') });
    } catch (err) {
      notify('ההעלאה נכשלה', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy('save');
    setError(undefined);
    try {
      const { id, ...json } = draft;
      await api(id ? `/api/admin/templates/${id}` : '/api/admin/templates', { method: id ? 'PUT' : 'POST', json });
      await qc.invalidateQueries({ queryKey: KEY });
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!draft?.id || !(await confirm('מחיקת תבנית', `למחוק את "${draft.name}"? זוגות שבחרו בה יחזרו לעיצוב הבסיסי.`, 'מחיקה'))) return;
    await api(`/api/admin/templates/${draft.id}`, { method: 'DELETE' });
    await qc.invalidateQueries({ queryKey: KEY });
    setDraft(null);
  }

  return (
    <Screen title="תבניות הזמנה" subtitle="העיצובים שזוגות בוחרים להזמנה ולאתר החתונה" maxWidth={960}>
      <AdminNav />
      <Button label="תבנית חדשה" icon="plus" onPress={() => setDraft({ ...EMPTY, sortOrder: (list.data?.length ?? 0) * 10 })} style={{ alignSelf: 'flex-start' }} />
      <View style={styles.grid}>
        {list.data?.map((t) => (
          <PressableScale key={t.id} onPress={() => setDraft(t)} style={styles.tile}>
            <View style={[styles.thumb, { backgroundColor: t.paperColor }]}>
              {t.backgroundUrl ? <Image source={t.backgroundUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={[styles.dot, { backgroundColor: t.accentColor }]} />
            </View>
            <Text variant="label">{t.name}</Text>
            <Text variant="caption" color={t.active ? colors.success : colors.inkMuted}>
              {t.active ? 'פעילה' : 'מוסתרת'}
            </Text>
          </PressableScale>
        ))}
        {list.data && !list.data.length ? <Text color={colors.inkSoft}>עוד אין תבניות. הוסיפו את הראשונה.</Text> : null}
      </View>

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        eyebrow="תבנית הזמנה"
        title={draft?.id ? 'עריכת תבנית' : 'תבנית חדשה'}
        footer={
          <>
            {draft?.id ? <Button variant="ghost" label="מחיקה" onPress={remove} style={{ flex: 1 }} /> : null}
            <Button label="שמירה" loading={busy === 'save'} disabled={(draft?.name.trim().length ?? 0) < 2} onPress={save} style={{ flex: 2 }} />
          </>
        }>
        {draft ? (
          <>
            <TextField label="שם התבנית" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button size="sm" variant="outline" icon="image" label={draft.backgroundUrl ? 'החלפת רקע' : 'העלאת תמונת רקע'} loading={busy === 'upload'} onPress={upload} />
              {draft.backgroundUrl ? <Button size="sm" variant="ghost" label="בלי תמונה" onPress={() => setDraft({ ...draft, backgroundUrl: null })} /> : null}
            </View>
            <View style={styles.colors}>
              {(
                [
                  ['paperColor', 'נייר'],
                  ['textColor', 'טקסט'],
                  ['accentColor', 'הדגשה'],
                ] as const
              ).map(([k, label]) => (
                <View key={k} style={{ flex: 1, gap: 4 }}>
                  <TextField label={label} ltr value={draft[k]} onChangeText={(v) => setDraft({ ...draft, [k]: v })} autoCapitalize="none" />
                  <View style={[styles.swatch, { backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(draft[k]) ? draft[k] : colors.stone }]} />
                </View>
              ))}
            </View>
            <ChipGroup>
              <Chip label="גופן קלאסי" selected={draft.font === 'serif'} onPress={() => setDraft({ ...draft, font: 'serif' })} />
              <Chip label="גופן נקי" selected={draft.font === 'sans'} onPress={() => setDraft({ ...draft, font: 'sans' })} />
              <Chip label={draft.active ? 'פעילה' : 'מוסתרת'} selected={draft.active} onPress={() => setDraft({ ...draft, active: !draft.active })} />
            </ChipGroup>
            <Text variant="caption" color={colors.inkSoft}>
              תצוגה מקדימה
            </Text>
            {[draft.paperColor, draft.textColor, draft.accentColor].every((c) => /^#[0-9A-Fa-f]{6}$/.test(c)) ? (
              <InvitationArt c={SAMPLE} template={{ ...draft, id: draft.id ?? 'preview' }} />
            ) : null}
            {error ? (
              <Text variant="bodySmall" color={colors.danger}>
                {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: 150, gap: 4 },
  thumb: { height: 190, borderRadius: radius.md, overflow: 'hidden', ...shadow.sm },
  dot: { position: 'absolute', top: 12, alignSelf: 'center', width: 22, height: 22, borderRadius: 11 },
  colors: { flexDirection: 'row', gap: space.sm },
  swatch: { height: 14, borderRadius: 7 },
});
