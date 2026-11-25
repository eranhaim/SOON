import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { colors, fonts, radius, shadow, space, textStart } from '@/theme/tokens';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = ['מה הדבר הבא שכדאי לנו לסגור?', 'איך לחלק את התקציב שלנו?', 'כמה זמן מראש סוגרים צלם?', 'טיפים לבחירת אולם'];

/** AI wedding advisor: questions about planning, answered with the couple's own data. */
export default function Advisor() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollViewType>>(null);

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setText('');
    setBusy(true);
    try {
      const r = await api<{ reply: string }>('/api/advisor', { method: 'POST', json: { messages: next } });
      setMessages([...next, { role: 'assistant', content: r.reply }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'משהו השתבש. נסו שוב בעוד רגע.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          scaleTo={0.9}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/couple/planning' as Href))}
          style={styles.back}>
          <Feather name="chevron-right" size={22} color={colors.ink} />
        </PressableScale>
        <View style={styles.avatar}>
          <Feather name="feather" size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="h3">היועצת של SOON</Text>
          <Text variant="caption" color={colors.inkMuted}>
            עונה לפי הנתונים של החתונה שלכם
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {!messages.length ? (
            <View style={{ gap: space.md }}>
              <Text variant="body" color={colors.inkSoft}>
                שאלו כל שאלה על התכנון: מה לסגור קודם, איך לחלק תקציב, מה לשאול ספק, לוחות זמנים ועוד.
              </Text>
              {STARTERS.map((s) => (
                <PressableScale key={s} onPress={() => ask(s)} style={styles.starter}>
                  <Text variant="bodySmall" style={{ flex: 1 }}>
                    {s}
                  </Text>
                  <Feather name="arrow-left" size={14} color={colors.gold} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          {messages.map((m, i) => (
            <View key={i} style={[styles.bubbleRow, m.role === 'user' ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, m.role === 'user' ? styles.mine : styles.theirs]}>
                <Text variant="body" color={m.role === 'user' ? colors.inverse : colors.ink}>
                  {m.content}
                </Text>
              </View>
            </View>
          ))}
          {busy ? <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-end' }} /> : null}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="שאלה ליועצת"
            placeholderTextColor={colors.inkMuted}
            multiline
            style={[styles.input, { textAlign: textStart }, { outlineStyle: 'none' } as object]}
            accessibilityLabel="שאלה"
          />
          <PressableScale accessibilityRole="button" accessibilityLabel="שליחה" scaleTo={0.9} disabled={!text.trim() || busy} onPress={() => ask(text)} style={styles.send}>
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
  messages: { gap: space.sm, padding: space.lg, maxWidth: 720, width: '100%', alignSelf: 'center' },
  starter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, ...shadow.sm },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-start' },
  rowTheirs: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...shadow.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md },
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
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
