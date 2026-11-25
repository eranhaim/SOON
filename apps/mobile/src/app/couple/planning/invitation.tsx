import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';

import {
  formatHebrewDate,
  INVITATION_STYLES,
  type InvitationDTO,
  type InvitationRequest,
  type InvitationStyle,
  type InvitationTemplateDTO,
  type WeddingSiteDTO,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { InvitationArt } from '@/components/InvitationArt';
import { PressableScale } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup, Divider } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { formatDayDots } from '@/lib/dates';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { SITE_KEY } from '@/lib/site';
import { useOwnWedding } from '@/lib/wedding';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const weekday = (iso: string) => `יום ${WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]}`;

/** AI wedding invitation: details → generated wording → designed card to save and share. */
export default function Invitation() {
  const w = useOwnWedding();
  const saved = useApiQuery<{ invitation: InvitationDTO | null }>(keys.invitation, '/api/planning/invitation');
  const site = useApiQuery<WeddingSiteDTO>(SITE_KEY, '/api/weddings/me/site');
  const templates = useApiQuery<InvitationTemplateDTO[]>(['invitation-templates'], '/api/invitation-templates');
  const saveSite = useApiMutation<WeddingSiteDTO>({ setData: SITE_KEY });
  const template = templates.data?.find((t) => t.id === site.data?.templateId) ?? null;
  const [form, setForm] = useState<InvitationRequest>(() => ({
    style: 'classic',
    partner1Name: w.partner1Name,
    partner2Name: w.partner2Name,
    partner1Parents: '',
    partner2Parents: '',
    weddingDate: w.weddingDate,
    hebrewDate: '',
    venueName: w.venueName ?? '',
    receptionTime: '19:00',
    chuppahTime: '20:30',
    extra: '',
  }));
  const [result, setResult] = useState<InvitationDTO | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<null | 'gen' | 'save'>(null);
  const [error, setError] = useState<string>();
  const set = (p: Partial<InvitationRequest>) => setForm((f) => ({ ...f, ...p }));

  // Show the saved invitation the first time the screen loads.
  const [adopted, setAdopted] = useState(false);
  if (!adopted && saved.data) {
    setAdopted(true);
    if (saved.data.invitation) {
      setResult(saved.data.invitation);
      setForm(saved.data.invitation.request);
    }
  }

  if (saved.isPending) return <Loading />;

  async function generate() {
    setError(undefined);
    setBusy('gen');
    try {
      const inv = await api<InvitationDTO>('/api/planning/invitation/generate', {
        method: 'POST',
        json: { ...form, hebrewDate: form.weddingDate ? formatHebrewDate(form.weddingDate) : '' },
      });
      setResult(inv);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!result) return;
    setBusy('save');
    try {
      await api('/api/planning/invitation', { method: 'PUT', json: result });
      await saved.refetch();
      notify('ההזמנה נשמרה');
    } catch (err) {
      notify('השמירה נכשלה', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!result) return;
    const r = result.request;
    const lines = [
      result.opening,
      `${r.partner1Name} ו${r.partner2Name}`,
      result.body,
      r.weddingDate ? `${weekday(r.weddingDate)}, ${formatDayDots(r.weddingDate)} · ${formatHebrewDate(r.weddingDate)}` : '',
      r.venueName,
      [r.receptionTime && `קבלת פנים ${r.receptionTime}`, r.chuppahTime && `חופה ${r.chuppahTime}`].filter(Boolean).join(' · '),
      result.closing,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n\n') });
    } catch {
      if (Platform.OS === 'web') notify('השיתוף לא נתמך בדפדפן הזה');
    }
  }

  return (
    <Screen back backTo="/couple/planning" title="הזמנה לחתונה" subtitle="נוסח בעזרת AI, מעוצב ומוכן לשליחה">
      {result ? (
        <>
          <TemplatePicker
            templates={templates.data ?? []}
            value={site.data?.templateId ?? null}
            onChange={(templateId) => saveSite.mutate({ path: '/api/weddings/me/site', method: 'PUT', json: { templateId } })}
          />
          <InvitationCard inv={result} template={template} />
          <Text variant="caption" color={colors.inkMuted} align="center">
            {result.source === 'ai' ? 'הנוסח נכתב בעזרת בינה מלאכותית' : 'נוסח מוכן מתוך מאגר הנוסחים של SOON'}
          </Text>

          {editing ? (
            <View style={{ gap: space.md }}>
              <TextField label="שורת פתיחה" value={result.opening} onChangeText={(opening) => setResult({ ...result, opening })} />
              <TextField label="גוף ההזמנה" multiline value={result.body} onChangeText={(body) => setResult({ ...result, body })} style={{ minHeight: 110 }} />
              <TextField label="שורת סיום" value={result.closing} onChangeText={(closing) => setResult({ ...result, closing })} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Button label="שמירה" icon="check" loading={busy === 'save'} onPress={save} style={{ flex: 1 }} />
            <Button label="שיתוף" icon="share-2" variant="outline" onPress={share} style={{ flex: 1 }} />
          </View>
          <View style={styles.actions}>
            <Button label="נוסח אחר" icon="refresh-cw" variant="soft" loading={busy === 'gen'} onPress={generate} style={{ flex: 1 }} />
            <Button label={editing ? 'סיום עריכה' : 'עריכת הנוסח'} icon="edit-3" variant="soft" onPress={() => setEditing(!editing)} style={{ flex: 1 }} />
          </View>
          <Button
            label="הזמנה אינטראקטיבית: אישורי הגעה, ברכות ומתנות"
            icon="globe"
            variant="outline"
            onPress={() => router.push('/couple/planning/site' as Href)}
          />
          <Divider ornament />
          <Text variant="h2">שינוי הפרטים</Text>
        </>
      ) : (
        <Text variant="body" color={colors.inkSoft}>
          מלאו את הפרטים ובחרו סגנון. נכתוב עבורכם נוסח אישי ונעצב אותו להזמנה.
        </Text>
      )}

      <View style={{ gap: space.md }}>
        <Text variant="eyebrow" color={colors.inkMuted}>
          סגנון
        </Text>
        <ChipGroup>
          {INVITATION_STYLES.map((s) => (
            <Chip key={s.key} label={s.label} selected={form.style === s.key} onPress={() => set({ style: s.key as InvitationStyle })} />
          ))}
        </ChipGroup>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="שם" value={form.partner1Name} onChangeText={(partner1Name) => set({ partner1Name })} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="שם" value={form.partner2Name} onChangeText={(partner2Name) => set({ partner2Name })} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label={`הורי ${form.partner1Name || 'הכלה'}`} placeholder="לא חובה" value={form.partner1Parents} onChangeText={(partner1Parents) => set({ partner1Parents })} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label={`הורי ${form.partner2Name || 'החתן'}`} placeholder="לא חובה" value={form.partner2Parents} onChangeText={(partner2Parents) => set({ partner2Parents })} />
          </View>
        </View>
        <DateField label="תאריך" value={form.weddingDate} onChange={(weddingDate) => set({ weddingDate })} />
        {form.weddingDate ? (
          <Text variant="caption" color={colors.inkSoft}>{`${weekday(form.weddingDate)} · ${formatHebrewDate(form.weddingDate)}`}</Text>
        ) : null}
        <TextField label="מקום" value={form.venueName} onChangeText={(venueName) => set({ venueName })} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField label="קבלת פנים" ltr value={form.receptionTime} onChangeText={(receptionTime) => set({ receptionTime })} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="חופה" ltr value={form.chuppahTime} onChangeText={(chuppahTime) => set({ chuppahTime })} />
          </View>
        </View>
        <TextField
          label="משהו שחשוב לכם שייכתב?"
          placeholder="למשל: נשמח לראות אתכם בלבן, אירוע ללא ילדים…"
          multiline
          value={form.extra}
          onChangeText={(extra) => set({ extra })}
          error={error}
        />
        <Button
          label={result ? 'יצירה מחדש עם הפרטים' : 'יצירת הזמנה'}
          icon="feather"
          loading={busy === 'gen'}
          disabled={!form.partner1Name.trim() || !form.partner2Name.trim()}
          onPress={generate}
        />
      </View>
    </Screen>
  );
}

/** The designed invitation, in the chosen template (shared with the wedding site). */
function InvitationCard({ inv, template }: { inv: InvitationDTO; template: InvitationTemplateDTO | null }) {
  const r = inv.request;
  return (
    <InvitationArt
      template={template}
      italic={inv.style === 'romantic'}
      c={{
        opening: inv.opening,
        body: inv.body,
        closing: inv.closing,
        partner1Name: r.partner1Name,
        partner2Name: r.partner2Name,
        weddingDate: r.weddingDate,
        venueName: r.venueName,
        receptionTime: r.receptionTime,
        chuppahTime: r.chuppahTime,
      }}
    />
  );
}

/** Admin-made designs; the choice is saved on the couple's wedding site. */
function TemplatePicker({ templates, value, onChange }: { templates: InvitationTemplateDTO[]; value: string | null; onChange: (id: string | null) => void }) {
  if (!templates.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="caption" color={colors.inkSoft}>
        עיצוב ההזמנה
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <PressableScale onPress={() => onChange(null)} style={[styles.tpl, { backgroundColor: colors.surface }, value == null && styles.tplOn]}>
          <Text variant="caption" align="center">
            בסיסי
          </Text>
        </PressableScale>
        {templates.map((t) => (
          <PressableScale key={t.id} accessibilityLabel={t.name} onPress={() => onChange(t.id)} style={[styles.tpl, { backgroundColor: t.paperColor }, value === t.id && styles.tplOn]}>
            {t.backgroundUrl ? <Image source={t.backgroundUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={[styles.tplDot, { backgroundColor: t.accentColor }]} />
            <Text variant="caption" align="center" color={t.textColor} numberOfLines={1} style={styles.tplName}>
              {t.name}
            </Text>
          </PressableScale>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tpl: { width: 92, height: 116, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', padding: 6, ...shadow.sm },
  tplOn: { borderWidth: 2, borderColor: colors.accent },
  tplDot: { position: 'absolute', top: 10, width: 18, height: 18, borderRadius: 9 },
  tplName: { fontFamily: fonts.bodyMedium },
  row: { flexDirection: 'row', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  card: { borderRadius: radius.lg, ...shadow.md, backgroundColor: colors.surface, padding: 10, borderWidth: 0 },
  inner: { borderRadius: radius.md, borderWidth: 1, borderColor: colors.goldLight, paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' },
  opening: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 1.5, color: colors.inkSoft },
  names: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, color: colors.ink, marginVertical: space.sm },
  rule: { width: 40, height: 1, backgroundColor: colors.gold, marginVertical: space.sm },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 24, color: colors.ink, maxWidth: 320 },
  weekday: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 2, color: colors.inkSoft },
  date: { fontFamily: fonts.displayLight, fontSize: 30, letterSpacing: 4, color: colors.ink },
  hebrew: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  venue: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.ink, marginTop: space.sm },
  times: { fontFamily: fonts.body, fontSize: 12, letterSpacing: 1, color: colors.inkSoft },
  closing: { fontFamily: fonts.display, fontSize: 17, fontStyle: 'italic', color: colors.ink },
});
