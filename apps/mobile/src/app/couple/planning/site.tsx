import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatAgorot, type SiteActivityDTO, type WeddingSiteDetails, type WeddingSiteDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { PressableScale, Reveal } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, IconButton, SectionTitle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { copyLink, shareLink, webUrl } from '@/lib/links';
import { useApiMutation, useApiQuery } from '@/lib/query';
import { SITE_KEY } from '@/lib/site';
import { useOwnWedding } from '@/lib/wedding';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const ACTIVITY_KEY = ['wedding-site-activity'] as const;

const DETAIL_FIELDS: { key: keyof Omit<WeddingSiteDetails, 'schedule'>; label: string; placeholder: string }[] = [
  { key: 'venueAddress', label: 'כתובת המקום', placeholder: 'לניווט ב־Waze ובמפות' },
  { key: 'dressCode', label: 'קוד לבוש', placeholder: 'אלגנטי, לבן…' },
  { key: 'parking', label: 'חניה', placeholder: 'חניה חינם בכניסה' },
  { key: 'shuttles', label: 'הסעות', placeholder: 'יוצאות מתל אביב ב־18:00' },
  { key: 'kids', label: 'ילדים', placeholder: 'נשמח לראות גם את הילדים' },
  { key: 'food', label: 'אוכל', placeholder: 'כשר, יש מנות טבעוניות' },
  { key: 'accessibility', label: 'נגישות', placeholder: 'המקום נגיש לכיסאות גלגלים' },
];

/** The couple's interactive invitation (wedding site): edit, publish, share, and see RSVPs, blessings, gifts. */
export default function SiteEditor() {
  const w = useOwnWedding();
  const site = useApiQuery<WeddingSiteDTO>(SITE_KEY, '/api/weddings/me/site');
  const act = useApiQuery<SiteActivityDTO>(ACTIVITY_KEY, '/api/weddings/me/site/activity', { refetchInterval: 30_000 });
  const save = useApiMutation<WeddingSiteDTO>({ setData: SITE_KEY });
  const [tab, setTab] = useState<'edit' | 'activity'>('edit');
  const [draft, setDraft] = useState<WeddingSiteDTO | null>(null);
  const [error, setError] = useState<string>();

  if (site.isPending || !site.data) return <Loading />;
  const s = draft ?? site.data;
  const url = webUrl(`/i/${s.slug}`);
  const set = (patch: Partial<WeddingSiteDTO>) => setDraft({ ...s, ...patch });
  const setDetail = (patch: Partial<WeddingSiteDetails>) => setDraft({ ...s, details: { ...s.details, ...patch } });

  function persist(patch?: Partial<WeddingSiteDTO>) {
    setError(undefined);
    const next = { ...s, ...patch };
    save.mutate(
      {
        path: '/api/weddings/me/site',
        method: 'PUT',
        json: {
          slug: next.slug,
          published: next.published,
          story: next.story?.trim() || null,
          details: next.details,
          rsvpEnabled: next.rsvpEnabled,
          giftsEnabled: next.giftsEnabled,
        },
      },
      {
        onSuccess: () => setDraft(null),
        onError: (e) => setError(errorMessage(e)),
      },
    );
  }

  const a = act.data;

  return (
    <Screen back backTo="/couple/planning/invitation" eyebrow="הזמנה אינטראקטיבית" title="אתר החתונה" subtitle="קישור אחד לאורחים: הזמנה, אישור הגעה, ניווט, ברכות ומתנות">
      <Reveal style={styles.linkCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" style={{ fontFamily: fonts.bodyMedium }}>
            {s.published ? 'האתר באוויר' : 'האתר עוד לא פורסם'}
          </Text>
          <Text variant="caption" color={colors.inkSoft} numberOfLines={1} style={{ writingDirection: 'ltr', textAlign: 'right' }}>
            {url.replace(/^https?:\/\//, '')}
          </Text>
        </View>
        <IconButton icon="eye" label="תצוגה" onPress={() => router.push(`/i/${s.slug}` as Href)} />
        <IconButton icon="copy" label="העתקה" onPress={() => void copyLink(url)} />
      </Reveal>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label={s.published ? 'הסתרת האתר' : 'פרסום האתר'}
          icon={s.published ? 'eye-off' : 'send'}
          variant={s.published ? 'outline' : 'primary'}
          loading={save.isPending}
          onPress={() => persist({ published: !s.published })}
          style={{ flex: 1 }}
        />
        {s.published ? (
          <Button
            label="שליחה לאורחים"
            icon="share-2"
            variant="soft"
            onPress={() => void shareLink(url, `החתונה של ${w.partner1Name} ו${w.partner2Name}`, `מתחתנים! כל הפרטים ואישור הגעה כאן:`)}
            style={{ flex: 1 }}
          />
        ) : null}
      </View>

      <Segmented
        options={[
          { key: 'edit', label: 'עריכה' },
          { key: 'activity', label: `אישורים וברכות${a ? ` · ${a.rsvp.yes + a.rsvp.no + a.rsvp.maybe + a.blessings.length}` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'edit' ? (
        <>
          <Card style={{ gap: space.md }}>
            <SectionTitle>הסיפור שלנו</SectionTitle>
            <TextField label="כמה מילים לאורחים" value={s.story ?? ''} onChangeText={(story) => set({ story })} multiline style={{ minHeight: 100, textAlignVertical: 'top' }} maxLength={3000} />
            <TextField
              label="כתובת האתר (באנגלית)"
              ltr
              autoCapitalize="none"
              value={s.slug}
              onChangeText={(slug) => set({ slug: slug.toLowerCase() })}
            />
          </Card>

          <Card style={{ gap: space.md }}>
            <SectionTitle>לוח זמנים</SectionTitle>
            {s.details.schedule.map((row, i) => (
              <View key={i} style={styles.schedRow}>
                <View style={{ width: 92 }}>
                  <TextField label="שעה" ltr value={row.time} onChangeText={(time) => setDetail({ schedule: s.details.schedule.map((r, j) => (j === i ? { ...r, time } : r)) })} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="מה קורה" value={row.label} onChangeText={(label) => setDetail({ schedule: s.details.schedule.map((r, j) => (j === i ? { ...r, label } : r)) })} />
                </View>
                <IconButton icon="trash-2" label="מחיקה" onPress={() => setDetail({ schedule: s.details.schedule.filter((_, j) => j !== i) })} />
              </View>
            ))}
            <Button variant="ghost" icon="plus" label="הוספת שורה" onPress={() => setDetail({ schedule: [...s.details.schedule, { time: '', label: '' }] })} />
          </Card>

          <Card style={{ gap: space.md }}>
            <SectionTitle>פרטים לאורחים</SectionTitle>
            {DETAIL_FIELDS.map((f) => (
              <TextField key={f.key} label={f.label} placeholder={f.placeholder} value={s.details[f.key] ?? ''} onChangeText={(v) => setDetail({ [f.key]: v })} />
            ))}
          </Card>

          <Card style={{ gap: space.sm }}>
            <Toggle label="אישורי הגעה באתר" hint="התשובות נכנסות לרשימת המוזמנים שלכם" value={s.rsvpEnabled} onChange={(rsvpEnabled) => set({ rsvpEnabled })} />
            <Toggle label="מתנה באשראי עם ברכה" hint="האורחים משלמים בכרטיס אשראי, והכסף מגיע אליכם" value={s.giftsEnabled} onChange={(giftsEnabled) => set({ giftsEnabled })} />
          </Card>

          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button label="שמירת השינויים" icon="check" loading={save.isPending} disabled={!draft} onPress={() => persist()} />
        </>
      ) : !a ? (
        <Loading />
      ) : (
        <>
          <View style={styles.stats}>
            <Stat value={String(a.rsvp.people)} label="מגיעים (אנשים)" />
            <Stat value={String(a.rsvp.no)} label="לא מגיעים" />
            <Stat value={formatAgorot(a.giftsTotalAgorot)} label="מתנות ששולמו" />
          </View>
          <Button variant="outline" icon="user-check" label="לרשימת המוזמנים" onPress={() => router.push('/couple/planning/guests' as Href)} />

          <SectionTitle>{`מתנות (${a.gifts.length})`}</SectionTitle>
          {a.gifts.length ? (
            a.gifts.map((g) => (
              <View key={g.id} style={styles.item}>
                <View style={styles.itemTop}>
                  <Text variant="body" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
                    {g.giverName}
                  </Text>
                  <Text variant="label" color={g.status === 'paid' ? colors.success : colors.inkMuted}>
                    {g.status === 'paid' ? formatAgorot(g.amountAgorot) : 'ממתין לתשלום'}
                  </Text>
                </View>
                {g.blessing ? (
                  <Text variant="bodySmall" color={colors.inkSoft}>
                    {g.blessing}
                  </Text>
                ) : null}
                <Text variant="caption" color={colors.inkMuted}>
                  {formatDate(g.paidAt ?? g.createdAt)}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="bodySmall" color={colors.inkMuted}>
              עוד אין מתנות.
            </Text>
          )}

          <SectionTitle>{`ברכות (${a.blessings.length})`}</SectionTitle>
          {a.blessings.length ? (
            a.blessings.map((b) => (
              <View key={b.id} style={styles.item}>
                <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
                  {b.name}
                </Text>
                <Text variant="bodySmall" color={colors.inkSoft}>
                  {b.body}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="bodySmall" color={colors.inkMuted}>
              עוד אין ברכות.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={styles.statNum}>{value}</Text>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
    </View>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <PressableScale accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color={colors.inkMuted}>
          {hint}
        </Text>
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]}>{value ? <Feather name="check" size={10} color={colors.accent} /> : null}</View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  schedRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  stats: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.offWhite },
  statNum: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  item: { gap: 4, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.sm },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  track: { width: 46, height: 26, borderRadius: 13, padding: 3, backgroundColor: colors.stone, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.accent, alignItems: 'flex-end' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  thumbOn: {},
});

