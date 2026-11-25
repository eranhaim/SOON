import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAgorot, formatHebrewDate, giftFee, type PublicSiteDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { DEFAULT_COVER } from '@/components/CoverPicker';
import { InvitationArt } from '@/components/InvitationArt';
import { PressableScale, Reveal } from '@/components/motion';
import { Loading } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDay } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const GIFT_AMOUNTS = [180, 300, 500, 1000];

/** Countdown to the wedding day (local evening start, updated every minute). */
function useCountdown(date: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!date) return null;
  const ms = new Date(`${date}T19:00:00+02:00`).getTime() - now;
  if (ms <= 0) return null;
  return { days: Math.floor(ms / 86_400_000), hours: Math.floor((ms / 3_600_000) % 24), minutes: Math.floor((ms / 60_000) % 60) };
}

const open = (url: string) => (Platform.OS === 'web' ? window.open(url, '_blank') : Linking.openURL(url));

/** The couple's wedding site for guests: /i/<slug>. No sign-in needed. */
export default function WeddingSite() {
  const { slug, gift } = useLocalSearchParams<{ slug: string; gift?: string }>();
  const insets = useSafeAreaInsets();
  const q = useApiQuery<PublicSiteDTO>(['site', slug], `/api/sites/${encodeURIComponent(slug)}`, { retry: false });
  const countdown = useCountdown(q.data?.weddingDate ?? null);

  if (q.isPending) return <Loading />;
  if (q.isError || !q.data) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: space.xl }]}>
        <Text variant="h2" align="center">
          האתר לא נמצא
        </Text>
        <Text variant="bodySmall" color={colors.inkSoft} align="center">
          בדקו את הקישור שקיבלתם.
        </Text>
      </View>
    );
  }
  const s = q.data;
  const names = `${s.partner1Name} ו${s.partner2Name}`;
  const address = s.details.venueAddress || s.venueName;
  const accent = s.template?.accentColor ?? colors.accent;

  const calendarUrl = s.weddingDate
    ? `https://calendar.google.com/calendar/render?${new URLSearchParams({
        action: 'TEMPLATE',
        text: `החתונה של ${names}`,
        dates: `${s.weddingDate.replace(/-/g, '')}T170000Z/${s.weddingDate.replace(/-/g, '')}T220000Z`,
        location: address ?? '',
      })}`
    : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: space.xxxl }}>
      {!s.published ? (
        <View style={[styles.preview, { paddingTop: insets.top + 6 }]}>
          <Text variant="caption" color={colors.inverse} align="center">
            תצוגה מקדימה — האתר עוד לא פורסם לאורחים
          </Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Image source={s.coverUrl ?? DEFAULT_COVER} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
        <LinearGradient colors={['rgba(36,18,15,0.25)', 'rgba(36,18,15,0.05)', 'rgba(36,18,15,0.8)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroText}>
          <Text variant="eyebrow" color="rgba(255,255,255,0.85)">
            מתחתנים
          </Text>
          <Text color={colors.inverse} align="center" style={styles.names}>
            {names}
          </Text>
          {s.weddingDate ? (
            <Text color={colors.inverse} align="center" style={styles.heroDate}>
              {`${formatDay(s.weddingDate)} · ${formatHebrewDate(s.weddingDate)}`}
            </Text>
          ) : null}
          {s.venueName ? (
            <Text color="rgba(255,255,255,0.85)" align="center" variant="bodySmall">
              {s.venueName}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {gift ? <GiftReturn slug={s.slug} giftId={gift} /> : null}

        {countdown ? (
          <Reveal style={styles.countdown}>
            <Count n={countdown.days} label="ימים" />
            <Count n={countdown.hours} label="שעות" />
            <Count n={countdown.minutes} label="דקות" />
          </Reveal>
        ) : null}

        {s.invitation ? (
          <Reveal index={1}>
            <InvitationArt
              template={s.template}
              c={{ ...s.invitation, partner1Name: s.partner1Name, partner2Name: s.partner2Name, weddingDate: s.weddingDate, venueName: s.venueName }}
            />
          </Reveal>
        ) : null}

        {s.story ? (
          <Section title="הסיפור שלנו">
            <Text variant="body" color={colors.inkSoft}>
              {s.story}
            </Text>
          </Section>
        ) : null}

        {s.details.schedule.length ? (
          <Section title="לוח זמנים">
            {s.details.schedule.map((r, i) => (
              <View key={i} style={styles.schedRow}>
                <Text style={[styles.schedTime, { color: accent }]}>{r.time}</Text>
                <Text variant="body">{r.label}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="איך מגיעים">
          {address ? (
            <Text variant="body" color={colors.inkSoft}>
              {address}
            </Text>
          ) : null}
          <View style={styles.navRow}>
            {address ? (
              <>
                <Button size="sm" variant="soft" icon="navigation" label="Waze" onPress={() => open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`)} style={{ flex: 1 }} />
                <Button size="sm" variant="soft" icon="map" label="מפות" onPress={() => open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`)} style={{ flex: 1 }} />
              </>
            ) : null}
            {calendarUrl ? <Button size="sm" variant="soft" icon="calendar" label="ליומן" onPress={() => open(calendarUrl)} style={{ flex: 1 }} /> : null}
          </View>
        </Section>

        <DetailsSection site={s} />

        {s.rsvpEnabled ? <RsvpForm slug={s.slug} /> : null}
        {s.giftsEnabled ? <GiftForm site={s} /> : null}
        <BlessingForm slug={s.slug} />

        <Text variant="caption" color={colors.inkMuted} align="center" style={{ marginTop: space.lg }}>
          נבנה באהבה ב־SOON
        </Text>
      </View>
    </ScrollView>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.countNum}>{String(n)}</Text>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal style={styles.section}>
      <Text variant="h2" align="center">
        {title}
      </Text>
      {children}
    </Reveal>
  );
}

function DetailsSection({ site }: { site: PublicSiteDTO }) {
  const rows = [
    ['קוד לבוש', site.details.dressCode, 'feather'],
    ['חניה', site.details.parking, 'square'],
    ['הסעות', site.details.shuttles, 'truck'],
    ['ילדים', site.details.kids, 'smile'],
    ['אוכל', site.details.food, 'coffee'],
    ['נגישות', site.details.accessibility, 'check-circle'],
  ].filter(([, v]) => v) as [string, string, 'feather'][];
  if (!rows.length) return null;
  return (
    <Section title="כדאי לדעת">
      {rows.map(([label, value, icon]) => (
        <View key={label} style={styles.detailRow}>
          <Feather name={icon} size={16} color={colors.gold} />
          <Text variant="body" style={{ flex: 1 }}>
            <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>{`${label}: `}</Text>
            {value}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function RsvpForm({ slug }: { slug: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [attending, setAttending] = useState<'yes' | 'no' | 'maybe' | null>(null);
  const [size, setSize] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();

  async function send() {
    if (!attending) return;
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/sites/${slug}/rsvp`, { method: 'POST', json: { name: name.trim(), phone: phone.trim() || null, attending, partySize: size } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="אישור הגעה">
      {done ? (
        <Text variant="body" align="center" color={colors.success}>
          {attending === 'no' ? 'תודה שעדכנתם. נתגעגע!' : 'תודה! נתראה בחתונה.'}
        </Text>
      ) : (
        <>
          <TextField label="שם מלא" value={name} onChangeText={setName} />
          <TextField label="טלפון" ltr keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <ChipGroup>
            <Chip label="מגיעים" selected={attending === 'yes'} onPress={() => setAttending('yes')} />
            <Chip label="אולי" selected={attending === 'maybe'} onPress={() => setAttending('maybe')} />
            <Chip label="לא נוכל להגיע" selected={attending === 'no'} onPress={() => setAttending('no')} />
          </ChipGroup>
          {attending && attending !== 'no' ? (
            <View style={styles.stepper}>
              <Text variant="body" style={{ flex: 1 }}>
                כמה תהיו?
              </Text>
              <PressableScale accessibilityLabel="פחות" onPress={() => setSize(Math.max(1, size - 1))} style={styles.stepBtn}>
                <Feather name="minus" size={16} color={colors.ink} />
              </PressableScale>
              <Text style={styles.stepNum}>{String(size)}</Text>
              <PressableScale accessibilityLabel="יותר" onPress={() => setSize(Math.min(20, size + 1))} style={styles.stepBtn}>
                <Feather name="plus" size={16} color={colors.ink} />
              </PressableScale>
            </View>
          ) : null}
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button label="שליחה" loading={busy} disabled={name.trim().length < 2 || !attending} onPress={send} />
        </>
      )}
    </Section>
  );
}

function GiftForm({ site }: { site: PublicSiteDTO }) {
  const [amount, setAmount] = useState<number | null>(300);
  const [custom, setCustom] = useState('');
  const [name, setName] = useState('');
  const [blessing, setBlessing] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const shekels = amount ?? (Number(custom.replace(/\D/g, '')) || 0);
  const agorot = shekels * 100;
  const fee = giftFee(agorot, site.giftFeeBps);

  async function pay() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api<{ url: string }>(`/api/sites/${site.slug}/gifts`, {
        method: 'POST',
        json: { giverName: name.trim(), blessing: blessing.trim() || null, amount: agorot },
      });
      if (Platform.OS === 'web') window.location.href = r.url;
      else await Linking.openURL(r.url);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Section title="מתנה לזוג">
      <Text variant="bodySmall" color={colors.inkSoft} align="center">
        שלחו מתנה בכרטיס אשראי, עם ברכה אישית.
      </Text>
      <ChipGroup>
        {GIFT_AMOUNTS.map((n) => (
          <Chip key={n} label={`₪${n}`} selected={amount === n} onPress={() => setAmount(n)} />
        ))}
        <Chip label="סכום אחר" selected={amount == null} onPress={() => setAmount(null)} />
      </ChipGroup>
      {amount == null ? <TextField label="סכום (₪)" ltr keyboardType="number-pad" value={custom} onChangeText={setCustom} /> : null}
      <TextField label="מי שולח/ת" value={name} onChangeText={setName} placeholder="משפחת כהן" />
      <TextField label="ברכה" value={blessing} onChangeText={setBlessing} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      {shekels >= 18 ? (
        <Text variant="caption" color={colors.inkMuted} align="center">
          {fee ? `${formatAgorot(agorot)} לזוג + ${formatAgorot(fee)} דמי שירות = ${formatAgorot(agorot + fee)}` : `סה״כ ${formatAgorot(agorot)}`}
        </Text>
      ) : null}
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Button label="למעבר לתשלום מאובטח" icon="lock" loading={busy} disabled={shekels < 18 || name.trim().length < 2} onPress={pay} />
    </Section>
  );
}

function BlessingForm({ slug }: { slug: string }) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/api/sites/${slug}/blessings`, { method: 'POST', json: { name: name.trim(), body: body.trim() } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="ברכה לזוג">
      {done ? (
        <Text variant="body" align="center" color={colors.success}>
          הברכה נשלחה. תודה!
        </Text>
      ) : (
        <>
          <TextField label="השם שלכם" value={name} onChangeText={setName} />
          <TextField label="הברכה" value={body} onChangeText={setBody} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Button variant="outline" label="שליחת ברכה" loading={busy} disabled={name.trim().length < 2 || body.trim().length < 2} onPress={send} />
        </>
      )}
    </Section>
  );
}

/** After the payment page sends the guest back: show the gift's status (polls a few times). */
function GiftReturn({ slug, giftId }: { slug: string; giftId: string }) {
  const q = useApiQuery<{ status: 'pending' | 'paid' | 'failed'; amountAgorot: number }>(['gift', giftId], `/api/sites/${slug}/gifts/${giftId}`, {
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false),
  });
  const st = q.data?.status;
  return (
    <View style={[styles.giftReturn, st === 'failed' && { backgroundColor: colors.dangerSoft }]}>
      <Feather name={st === 'paid' ? 'heart' : st === 'failed' ? 'x-circle' : 'clock'} size={18} color={st === 'failed' ? colors.danger : colors.accent} />
      <Text variant="body" style={{ flex: 1 }}>
        {st === 'paid'
          ? `תודה! המתנה (${formatAgorot(q.data!.amountAgorot)}) והברכה התקבלו.`
          : st === 'failed'
            ? 'התשלום לא הושלם. אפשר לנסות שוב.'
            : 'מאשרים את התשלום…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  preview: { backgroundColor: colors.accent, paddingBottom: 6 },
  hero: { height: 460, justifyContent: 'flex-end', backgroundColor: colors.night },
  heroText: { alignItems: 'center', gap: 6, padding: space.xl, paddingBottom: space.xxl },
  names: { fontFamily: fonts.display, fontSize: 40, lineHeight: 50 },
  heroDate: { fontFamily: fonts.bodyMedium, fontSize: 14, letterSpacing: 1 },
  body: { gap: space.xl, padding: space.lg, marginTop: -space.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  countdown: { flexDirection: 'row', padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.md },
  countNum: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: colors.ink },
  section: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  schedRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, justifyContent: 'center' },
  schedTime: { fontFamily: fonts.displayMedium, fontSize: 18 },
  navRow: { flexDirection: 'row', gap: space.sm },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
  stepNum: { fontFamily: fonts.displayMedium, fontSize: 20, minWidth: 24, textAlign: 'center' },
  giftReturn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.accentSoft },
});
