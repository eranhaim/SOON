/**
 * Everything a couple does from a vendor page: send an inquiry (message / availability / quote),
 * book a match call or ask for a call back, and write a review.
 */
import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { CallSlotsDTO, MyReviewDTO, VendorPublicDTO } from '@soon/shared';

import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDayShort, formatTime } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { DateField } from './DateField';
import { PressableScale } from './motion';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';
import { Chip, ChipGroup } from './ui';

export type InquiryKind = 'message' | 'availability' | 'quote';

const INQUIRY_TITLES: Record<InquiryKind, string> = {
  message: 'הודעה לספק',
  availability: 'בדיקת זמינות',
  quote: 'בקשת הצעת מחיר',
};

const INQUIRY_TEXT: Record<InquiryKind, (name: string) => string> = {
  message: (n) => `היי ${n}, ראינו את העמוד שלכם ב־SOON ונשמח לשמוע עוד.`,
  availability: () => 'היי, האם אתם פנויים בתאריך שלנו?',
  quote: () => 'היי, נשמח לקבל הצעת מחיר.',
};

/** When the API says the couple has no wedding yet, send them to finish it first. */
function handleNoWedding(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 404 && /wedding/i.test(String(err.data.error ?? ''))) {
    router.push('/couple/onboarding' as Href);
    return true;
  }
  return false;
}

export function InquirySheet({
  vendor,
  kind,
  weddingDate,
  onClose,
}: {
  vendor: VendorPublicDTO;
  kind: InquiryKind | null;
  weddingDate: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [date, setDate] = useState<string | null>(weddingDate);
  const [guests, setGuests] = useState('');
  const [packageId, setPackageId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [seenKind, setSeenKind] = useState<InquiryKind | null>(null);
  if (kind !== seenKind) {
    setSeenKind(kind);
    if (kind) {
      setMessage(INQUIRY_TEXT[kind](vendor.businessName));
      setDate(weddingDate);
      setError(undefined);
    }
  }

  async function send() {
    if (!kind) return;
    setBusy(true);
    setError(undefined);
    try {
      const n = Number(guests.replace(/\D/g, ''));
      const r = await api<{ conversationId: string }>(`/api/vendors/${vendor.id}/inquiries`, {
        method: 'POST',
        json: { kind, message: message.trim(), eventDate: date, guestCount: n > 0 ? n : null, packageId },
      });
      await qc.invalidateQueries({ queryKey: keys.conversations });
      onClose();
      router.push({ pathname: '/messages/[id]', params: { id: r.conversationId } });
    } catch (err) {
      if (!handleNoWedding(err)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={kind != null}
      onClose={onClose}
      eyebrow={vendor.businessName}
      title={kind ? INQUIRY_TITLES[kind] : ''}
      footer={<Button label="שליחה" icon="send" loading={busy} disabled={message.trim().length < 2} onPress={send} style={{ flex: 1 }} />}>
      <TextField label="ההודעה" value={message} onChangeText={setMessage} multiline style={{ minHeight: 110, textAlignVertical: 'top' }} maxLength={2000} />
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <DateField label="תאריך האירוע" value={date} onChange={setDate} clearable />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="מספר מוזמנים" ltr keyboardType="number-pad" value={guests} onChangeText={setGuests} placeholder="300" />
        </View>
      </View>
      {kind === 'quote' && vendor.packages.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color={colors.inkSoft}>
            חבילה (לא חובה)
          </Text>
          <ChipGroup>
            {vendor.packages.map((p) => (
              <Chip key={p.id} label={p.name} selected={packageId === p.id} onPress={() => setPackageId(packageId === p.id ? null : p.id)} />
            ))}
          </ChipGroup>
        </View>
      ) : null}
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

/** Book a match call in one of the vendor's free slots, or ask them to call back. */
export function MatchCallSheet({ vendor, visible, onClose }: { vendor: VendorPublicDTO; visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const slots = useApiQuery<CallSlotsDTO>(['call-slots', vendor.id], visible ? `/api/vendors/${vendor.id}/call-slots` : null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [mode, setMode] = useState<'book' | 'callback'>('book');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const days = slots.data?.days ?? [];
  const activeDay = days.find((d) => d.date === day) ?? days[0];

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const r =
        mode === 'book'
          ? await api<{ conversationId: string }>(`/api/vendors/${vendor.id}/call-booking`, { method: 'POST', json: { startsAt: slot } })
          : await api<{ conversationId: string }>(`/api/vendors/${vendor.id}/callback`, { method: 'POST', json: { phone: phone.trim() || null } });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.conversations }), qc.invalidateQueries({ queryKey: keys.events })]);
      onClose();
      router.push({ pathname: '/messages/[id]', params: { id: r.conversationId } });
    } catch (err) {
      if (!handleNoWedding(err)) setError(errorMessage(err));
      if (err instanceof ApiError && err.status === 409) void slots.refetch();
    } finally {
      setBusy(false);
    }
  }

  const noSlots = !slots.isPending && (!slots.data?.enabled || days.length === 0);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={vendor.businessName}
      title="שיחת התאמה"
      footer={
        <Button
          label={mode === 'book' ? (slot ? `קביעת שיחה ב־${formatTime(slot)}` : 'בחרו שעה') : 'שליחת בקשה'}
          loading={busy}
          disabled={mode === 'book' && !slot}
          onPress={submit}
          style={{ flex: 1 }}
        />
      }>
      <Text variant="bodySmall" color={colors.inkSoft}>
        {`שיחה קצרה${slots.data ? ` (${slots.data.slotMinutes} דקות)` : ''} להכיר, לשאול ולבדוק התאמה, בלי התחייבות.`}
      </Text>
      <View style={styles.modes}>
        <Chip label="קביעת מועד" selected={mode === 'book'} onPress={() => setMode('book')} />
        <Chip label="שיחזרו אליי" selected={mode === 'callback'} onPress={() => setMode('callback')} />
      </View>

      {mode === 'book' ? (
        noSlots ? (
          <View style={styles.empty}>
            <Feather name="phone-off" size={18} color={colors.inkMuted} />
            <Text variant="bodySmall" color={colors.inkSoft} style={{ flex: 1 }}>
              אין כרגע שעות פנויות בשבועיים הקרובים. בקשו שיחזרו אליכם.
            </Text>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {days.map((d) => (
                <Chip
                  key={d.date}
                  label={formatDayShort(d.date)}
                  selected={activeDay?.date === d.date}
                  onPress={() => {
                    setDay(d.date);
                    setSlot(null);
                  }}
                />
              ))}
            </ScrollView>
            <View style={styles.slots}>
              {activeDay?.slots.map((s) => (
                <PressableScale
                  key={s}
                  accessibilityRole="button"
                  accessibilityState={{ selected: slot === s }}
                  onPress={() => setSlot(s)}
                  style={[styles.slot, slot === s && styles.slotOn]}>
                  <Text variant="label" color={slot === s ? colors.inverse : colors.ink} style={{ fontFamily: fonts.bodyMedium }}>
                    {formatTime(s)}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </>
        )
      ) : (
        <>
          <TextField label="הטלפון שלכם" ltr keyboardType="phone-pad" autoComplete="tel" value={phone} onChangeText={setPhone} placeholder="050-0000000" />
          <Text variant="caption" color={colors.inkMuted}>
            אם כבר שמרתם טלפון בפרטי החתונה, אפשר להשאיר ריק.
          </Text>
        </>
      )}
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const SUB_RATINGS = [
  { key: 'ratingProfessionalism', label: 'מקצועיות' },
  { key: 'ratingService', label: 'שירות' },
  { key: 'ratingAvailability', label: 'זמינות' },
  { key: 'ratingValue', label: 'תמורה למחיר' },
] as const;
type SubKey = (typeof SUB_RATINGS)[number]['key'];

function Stars({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) {
  return (
    <View style={styles.stars} accessibilityRole="adjustable" accessibilityValue={{ min: 1, max: 5, now: value }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale key={n} accessibilityLabel={`${n} כוכבים`} scaleTo={0.85} onPress={() => onChange(n)} hitSlop={4}>
          <Feather name="star" size={size} color={n <= value ? colors.gold : colors.stoneDeep} />
        </PressableScale>
      ))}
    </View>
  );
}

/** A couple writes (or edits) their review of a vendor. */
export function ReviewSheet({ vendor, visible, onClose }: { vendor: VendorPublicDTO; visible: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const mine = useApiQuery<{ review: MyReviewDTO }>(['my-review', vendor.id], visible ? `/api/vendors/${vendor.id}/my-review` : null);
  const [rating, setRating] = useState(0);
  const [subs, setSubs] = useState<Record<SubKey, number>>({ ratingProfessionalism: 0, ratingService: 0, ratingAvailability: 0, ratingValue: 0 });
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const existing = mine.data?.review;
  if (mine.data && loadedFor !== (existing?.id ?? 'new')) {
    setLoadedFor(existing?.id ?? 'new');
    if (existing) {
      setRating(existing.rating);
      setBody(existing.body);
      setSubs({
        ratingProfessionalism: existing.ratingProfessionalism ?? 0,
        ratingService: existing.ratingService ?? 0,
        ratingAvailability: existing.ratingAvailability ?? 0,
        ratingValue: existing.ratingValue ?? 0,
      });
    }
  }

  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      const json = {
        rating,
        body: body.trim(),
        ...Object.fromEntries(SUB_RATINGS.map((s) => [s.key, subs[s.key] || null])),
      };
      await api(`/api/vendors/${vendor.id}/my-review`, { method: 'PUT', json });
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.reviews(vendor.slug) }),
        qc.invalidateQueries({ queryKey: ['my-review', vendor.id] }),
      ]);
      onClose();
    } catch (err) {
      if (!handleNoWedding(err)) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow={vendor.businessName}
      title={existing ? 'עריכת הביקורת שלכם' : 'כתיבת ביקורת'}
      footer={<Button label="פרסום" loading={busy} disabled={!rating || body.trim().length < 10} onPress={save} style={{ flex: 1 }} />}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Stars value={rating} onChange={setRating} size={34} />
        <Text variant="caption" color={colors.inkMuted}>
          דירוג כללי
        </Text>
      </View>
      {SUB_RATINGS.map((s) => (
        <View key={s.key} style={styles.subRow}>
          <Text variant="bodySmall" style={{ flex: 1 }}>
            {s.label}
          </Text>
          <Stars value={subs[s.key]} onChange={(n) => setSubs({ ...subs, [s.key]: n })} size={20} />
        </View>
      ))}
      <TextField
        label="איך היה לעבוד איתם?"
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={3000}
        style={{ minHeight: 120, textAlignVertical: 'top' }}
        placeholder="ספרו לזוגות אחרים מה היה טוב, ומה כדאי לדעת"
      />
      {error ? (
        <Text variant="bodySmall" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  modes: { flexDirection: 'row', gap: space.sm },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.offWhite,
  },
  slotOn: { backgroundColor: colors.accent },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.offWhite },
  stars: { flexDirection: 'row', gap: 6 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
