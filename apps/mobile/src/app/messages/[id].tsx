import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatAgorot, LEAD_STATUS_LABELS, type ConversationDetail } from '@soon/shared';

import { Button } from '@/components/Button';

import { PressableScale } from '@/components/motion';
import { Loading } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, corners, fonts, shadow, space, textStart } from '@/theme/tokens';

/** One conversation (spec §8). Polls every few seconds, so both sides see new messages live. */
export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useApiQuery<ConversationDetail>(keys.conversation(id), `/api/conversations/${id}`, { refetchInterval: 3000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [addingLead, setAddingLead] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollViewType>>(null);
  const count = q.data?.messages.length ?? 0;

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [count]);

  if (q.isPending || !q.data) return <Loading />;
  const d = q.data;
  const title = d.viewerSide === 'couple' ? d.conversation.vendor.businessName : d.conversation.couple.names;
  const ctx = [
    d.context.eventDate ? formatDay(d.context.eventDate) : null,
    d.context.guestCount ? `${d.context.guestCount} מוזמנים` : null,
    d.context.venueName,
    d.context.quotedPriceAgorot ? `הצעה: ${formatAgorot(d.context.quotedPriceAgorot)}` : null,
  ].filter(Boolean);

  async function addLead() {
    setAddingLead(true);
    try {
      const { leadId } = await api<{ leadId: string }>(`/api/conversations/${id}/lead`, { method: 'POST' });
      await Promise.all([qc.invalidateQueries({ queryKey: keys.conversation(id) }), qc.invalidateQueries({ queryKey: keys.leads })]);
      router.push({ pathname: '/vendor/lead/[id]', params: { id: leadId } });
    } finally {
      setAddingLead(false);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api(`/api/conversations/${id}/messages`, { method: 'POST', json: { body } });
      setText('');
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.conversation(id) }),
        qc.invalidateQueries({ queryKey: keys.conversations }),
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          scaleTo={0.9}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/messages' as Href))}
          style={styles.back}>
          <Feather name="chevron-right" size={22} color={colors.ink} />
        </PressableScale>
        <View style={styles.avatar}>
          <Text color={colors.accent} style={{ fontFamily: fonts.display, fontSize: 18 }}>
            {title.trim().charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
            {d.viewerSide === 'couple' ? d.conversation.vendor.categoryLabel : 'זוג'}
          </Text>
        </View>
      </View>

      {ctx.length ? (
        <View style={styles.context}>
          <Feather name="info" size={13} color={colors.gold} />
          <Text variant="caption" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1 }}>
            {ctx.join(' · ')}
          </Text>
        </View>
      ) : null}

      {d.viewerSide === 'vendor' ? (
        d.conversation.leadId ? (
          <PressableScale
            onPress={() => router.push({ pathname: '/vendor/lead/[id]', params: { id: d.conversation.leadId! } })}
            style={styles.crm}>
            <Feather name="user-check" size={14} color={colors.ink} />
            <Text variant="caption" style={{ flex: 1, fontFamily: fonts.bodyMedium }}>
              {`ברשימת הלקוחות${d.conversation.leadStatus ? ` · ${LEAD_STATUS_LABELS[d.conversation.leadStatus]}` : ''}`}
            </Text>
            <Text variant="caption">לכרטיס הלקוח ←</Text>
          </PressableScale>
        ) : (
          <View style={styles.crm}>
            <Feather name="user-plus" size={14} color={colors.ink} />
            <Text variant="caption" style={{ flex: 1 }}>
              השיחה עוד לא ברשימת הלקוחות
            </Text>
            <Button label="הוספה כלקוח" size="sm" loading={addingLead} onPress={addLead} />
          </View>
        )
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {d.messages.map((m) => (
            <View key={m.id} style={[styles.bubbleRow, m.mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
                <Text variant="body" color={m.mine ? colors.inverse : colors.ink}>
                  {m.body ?? 'קובץ מצורף'}
                </Text>
                <Text variant="caption" color={m.mine ? 'rgba(255,255,255,0.7)' : colors.inkMuted} style={{ fontSize: 10 }}>
                  {formatTime(m.createdAt)}
                  {m.mine && d.otherReadAt && d.otherReadAt >= m.createdAt ? ' · נקרא' : ''}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="כתבו הודעה…"
            placeholderTextColor={colors.inkMuted}
            multiline
            onSubmitEditing={send}
            style={[styles.input, { textAlign: textStart }, { outlineStyle: 'none' } as object]}
            accessibilityLabel="הודעה"
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="שליחה"
            disabled={!text.trim() || sending}
            onPress={send}
            scaleTo={0.9}
            style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}>
            {/* RTL: "send" points left */}
            <Feather name="send" size={18} color={colors.inverse} style={{ transform: [{ scaleX: -1 }] }} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  back: { width: 40, height: 40, borderRadius: corners.iconButton, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: space.lg,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    borderRadius: corners.chip,
    backgroundColor: colors.goldSoft,
  },
  messages: { padding: space.lg, gap: space.sm, maxWidth: 720, width: '100%', alignSelf: 'center' },
  bubbleRow: { flexDirection: 'row' },
  // RTL: my messages sit at the start (right) side.
  rowMine: { justifyContent: 'flex-start' },
  rowTheirs: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 0, gap: 2 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 0 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 0, ...shadow.sm },
  crm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 8,
    backgroundColor: colors.offWhite,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: corners.input,
    ...shadow.sm,
  },
  send: { width: 48, height: 48, borderRadius: corners.iconButton, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.accent },
});
