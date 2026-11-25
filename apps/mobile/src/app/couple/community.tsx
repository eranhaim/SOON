import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { regionLabel, type CommunityCoupleDTO, type CoupleChatListItem } from '@soon/shared';

import { Button } from '@/components/Button';
import { CountBadge } from '@/components/CountBadge';
import { PressableScale, Reveal } from '@/components/motion';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { formatDate, formatDayDots } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

const COMMUNITY = ['community'] as const;
const CHATS = ['couple-chats'] as const;
const ME = ['community-me'] as const;

/** Couples community: opt in, find couples who are getting married too, and chat with them. */
export default function Community() {
  const qc = useQueryClient();
  const me = useApiQuery<{ optIn: boolean; bio: string | null }>(ME, '/api/community/me');
  const chats = useApiQuery<CoupleChatListItem[]>(CHATS, '/api/couple-chats', { refetchInterval: 15_000 });
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const list = useApiQuery<CommunityCoupleDTO[]>([...COMMUNITY, q], `/api/community${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  const [bio, setBio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const optIn = me.data?.optIn ?? false;
  const bioValue = bio ?? me.data?.bio ?? '';

  async function saveProfile(next: { optIn: boolean; bio: string }) {
    setSaving(true);
    try {
      await api('/api/community/me', { method: 'PUT', json: { optIn: next.optIn, bio: next.bio.trim() || null } });
      await Promise.all([qc.invalidateQueries({ queryKey: ME }), qc.invalidateQueries({ queryKey: COMMUNITY })]);
      setBio(null);
    } catch (err) {
      notify('השמירה נכשלה', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function openChat(weddingId: string) {
    setOpening(weddingId);
    try {
      const { chatId } = await api<{ chatId: string }>('/api/couple-chats', { method: 'POST', json: { weddingId } });
      await qc.invalidateQueries({ queryKey: CHATS });
      router.push({ pathname: '/couple/chat/[id]', params: { id: chatId } });
    } catch (err) {
      notify('לא הצלחנו לפתוח שיחה', errorMessage(err));
    } finally {
      setOpening(null);
    }
  }

  return (
    <Screen back backTo="/couple/profile" eyebrow="קהילה" title="זוגות שמתחתנים" subtitle="שאלו, המליצו והתייעצו עם זוגות אחרים">
      <Reveal>
        <Card style={{ gap: space.sm }}>
          <View style={styles.optRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3">{optIn ? 'אתם בקהילה' : 'הצטרפו לקהילה'}</Text>
              <Text variant="caption" color={colors.inkSoft}>
                {optIn
                  ? 'זוגות אחרים רואים את השמות שלכם, החודש של החתונה והשורה שכתבתם.'
                  : 'כשתצטרפו, זוגות אחרים יוכלו לראות אתכם ולשלוח לכם הודעה. בלי טלפון ובלי אימייל.'}
              </Text>
            </View>
          </View>
          <TextField
            label="שורה עליכם (לא חובה)"
            value={bioValue}
            onChangeText={setBio}
            placeholder="מתחתנים בקיץ בצפון, מחפשים המלצות על DJ"
            maxLength={200}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {optIn ? (
              <>
                <Button variant="ghost" label="יציאה מהקהילה" loading={saving} onPress={() => saveProfile({ optIn: false, bio: bioValue })} style={{ flex: 1 }} />
                <Button label="שמירה" loading={saving} disabled={bio == null} onPress={() => saveProfile({ optIn: true, bio: bioValue })} style={{ flex: 1 }} />
              </>
            ) : (
              <Button label="הצטרפות לקהילה" icon="users" loading={saving} onPress={() => saveProfile({ optIn: true, bio: bioValue })} style={{ flex: 1 }} />
            )}
          </View>
        </Card>
      </Reveal>

      {chats.data?.length ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle>השיחות שלכם</SectionTitle>
          {chats.data.map((c) => (
            <PressableScale
              key={c.id}
              scaleTo={0.98}
              onPress={() => router.push({ pathname: '/couple/chat/[id]', params: { id: c.id } })}
              style={styles.chatRow}>
              <View style={styles.avatar}>
                <Text color={colors.accent} style={styles.avatarText}>
                  {c.other.names.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
                  {c.other.names}
                </Text>
                <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                  {c.lastMessage ? `${c.lastMessage.mine ? 'אתם: ' : ''}${c.lastMessage.body}` : 'עוד אין הודעות'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {c.lastMessage ? (
                  <Text variant="caption" color={colors.inkMuted}>
                    {formatDate(c.lastMessage.at)}
                  </Text>
                ) : null}
                <CountBadge count={c.unread} />
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <SectionTitle>זוגות בקהילה</SectionTitle>
      <TextField label="חיפוש" value={text} onChangeText={setText} placeholder="שם, אזור או נושא" />
      {list.data && !list.data.length ? (
        <Card tone="muted">
          <EmptyState icon="users" title="עוד אין כאן זוגות" body={q ? 'נסו חיפוש אחר.' : 'הזמינו זוגות חברים להצטרף, ותהיו הראשונים.'} />
        </Card>
      ) : null}
      {list.data?.map((c, i) => (
        <Reveal key={c.weddingId} index={Math.min(i, 8)}>
          <View style={styles.couple}>
            <View style={styles.coupleTop}>
              <View style={styles.avatarLg}>
                <Text color={colors.inverse} style={styles.avatarText}>
                  {c.names.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3">{c.names}</Text>
                <Text variant="caption" color={colors.inkMuted}>
                  {[c.weddingDate ? formatDayDots(c.weddingDate) : null, c.region ? regionLabel(c.region) : null].filter(Boolean).join(' · ') || 'תאריך עוד לא נקבע'}
                </Text>
              </View>
            </View>
            {c.bio ? (
              <Text variant="bodySmall" color={colors.inkSoft}>
                {c.bio}
              </Text>
            ) : null}
            {c.bookedCategories.length ? (
              <View style={styles.booked}>
                <Feather name="check-circle" size={13} color={colors.success} />
                <Text variant="caption" color={colors.inkSoft} style={{ flex: 1 }}>
                  {`כבר סגרו: ${c.bookedCategories.join(', ')}`}
                </Text>
              </View>
            ) : null}
            <Button
              variant={c.chatId ? 'outline' : 'soft'}
              size="sm"
              icon="message-circle"
              label={c.chatId ? 'להמשך השיחה' : 'שליחת הודעה'}
              loading={opening === c.weddingId}
              disabled={!optIn}
              onPress={() => (c.chatId ? router.push({ pathname: '/couple/chat/[id]', params: { id: c.chatId } }) : openChat(c.weddingId))}
            />
            {!optIn ? (
              <Text variant="caption" color={colors.inkMuted}>
                הצטרפו לקהילה כדי לשלוח הודעות.
              </Text>
            ) : null}
          </View>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  optRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  avatarLg: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  couple: { gap: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  coupleTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  booked: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
