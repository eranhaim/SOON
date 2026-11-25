import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoupleChatDetail } from '@soon/shared';

import { PressableScale } from '@/components/motion';
import { Loading } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { formatTime } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space, textStart } from '@/theme/tokens';

/** Couple ↔ couple chat (community). Polls every few seconds, like vendor chats. */
export default function CoupleChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const key = ['couple-chat', id];
  const q = useApiQuery<CoupleChatDetail>(key, `/api/couple-chats/${id}`, { refetchInterval: 3000 });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollViewType>>(null);
  const count = q.data?.messages.length ?? 0;

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [count]);

  // Opening marks the chat read: refresh the red counters.
  const loaded = Boolean(q.data);
  useEffect(() => {
    if (!loaded) return;
    void qc.invalidateQueries({ queryKey: keys.unread });
    void qc.invalidateQueries({ queryKey: ['couple-chats'] });
  }, [loaded, count, qc]);

  if (q.isPending || !q.data) return <Loading />;
  const d = q.data;

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api(`/api/couple-chats/${id}/messages`, { method: 'POST', json: { body } });
      setText('');
      await qc.invalidateQueries({ queryKey: key });
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
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/couple/community' as Href))}
          style={styles.back}>
          <Feather name="chevron-right" size={22} color={colors.ink} />
        </PressableScale>
        <View style={styles.avatar}>
          <Text color={colors.accent} style={{ fontFamily: fonts.display, fontSize: 18 }}>
            {d.chat.other.names.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3" numberOfLines={1}>
            {d.chat.other.names}
          </Text>
          <Text variant="caption" color={colors.inkMuted}>
            זוג מהקהילה
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {!d.messages.length ? (
            <Text variant="bodySmall" color={colors.inkMuted} align="center" style={{ marginTop: space.xl }}>
              כתבו שלום, שאלו על ספקים, או שתפו טיפ.
            </Text>
          ) : null}
          {d.messages.map((m) => (
            <View key={m.id} style={[styles.bubbleRow, m.mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, m.mine ? styles.mine : styles.theirs]}>
                <Text variant="body" color={m.mine ? colors.inverse : colors.ink}>
                  {m.body}
                </Text>
                <Text variant="caption" color={m.mine ? 'rgba(255,255,255,0.7)' : colors.inkMuted} style={{ alignSelf: 'flex-end' }}>
                  {formatTime(m.createdAt)}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="הודעה"
            placeholderTextColor={colors.inkMuted}
            multiline
            style={[styles.input, { textAlign: textStart }, { outlineStyle: 'none' } as object]}
            accessibilityLabel="הודעה"
          />
          <PressableScale accessibilityRole="button" accessibilityLabel="שליחה" scaleTo={0.9} disabled={!text.trim() || sending} onPress={send} style={styles.send}>
            <Feather name="send" size={18} color={colors.inverse} />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  back: { width: 40, height: 40, borderRadius: radius.round, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  messages: { gap: space.sm, padding: space.lg },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-start' },
  rowTheirs: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 2 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, backgroundColor: colors.background },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    ...shadow.sm,
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.accent },
});
