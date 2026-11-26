import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { PLAYLIST_STAGES, type PlaylistStage, type SongDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { Chip, ChipGroup } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, space } from '@/theme/tokens';

type Draft = { id?: string; stage: PlaylistStage; title: string; artist: string; url: string; note: string };

/** Wedding playlist: songs grouped by the moments of the evening, in order. */
export default function Playlist() {
  const q = useApiQuery<SongDTO[]>(keys.playlist, '/api/planning/playlist');
  const m = useApiMutation<SongDTO[]>({ setData: keys.playlist });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string>();

  if (q.isPending) return <Loading />;
  const songs = q.data ?? [];

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) return setError('נא לכתוב שם שיר');
    setError(undefined);
    const json = {
      stage: draft.stage,
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      url: draft.url.trim() || null,
      note: draft.note.trim() || null,
    };
    try {
      await m.mutateAsync(
        draft.id ? { path: `/api/planning/playlist/${draft.id}`, method: 'PATCH', json } : { path: '/api/planning/playlist', json },
      );
      setDraft(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function move(stage: PlaylistStage, index: number, delta: -1 | 1) {
    const ids = songs.filter((s) => s.stage === stage).map((s) => s.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    m.mutate({ path: '/api/planning/playlist/order', method: 'PUT', json: { stage, ids } });
  }

  const listen = (s: SongDTO) =>
    Linking.openURL(s.url ?? `https://www.youtube.com/results?search_query=${encodeURIComponent([s.title, s.artist].filter(Boolean).join(' '))}`);

  return (
    <Screen back backTo="/couple/planning" title="פלייליסט החתונה" subtitle={`${songs.length} שירים`}>
      <Text variant="bodySmall" color={colors.inkSoft}>
        בנו את הפסקול של הערב לפי הרגעים שלו. אפשר לשתף את הרשימה עם הדיג׳יי.
      </Text>

      {PLAYLIST_STAGES.map((stage) => {
        const list = songs.filter((s) => s.stage === stage.key);
        return (
          <View key={stage.key} style={styles.stage}>
            <View style={styles.stageHead}>
              <Text variant="h3" style={{ flex: 1, fontFamily: fonts.displayMedium, fontSize: 19 }}>
                {stage.label}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>
                {list.length ? `${list.length} שירים` : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`הוספת שיר ל${stage.label}`}
                hitSlop={8}
                onPress={() => setDraft({ stage: stage.key, title: '', artist: '', url: '', note: '' })}
                style={styles.add}>
                <Feather name="plus" size={16} color={colors.ink} />
              </Pressable>
            </View>
            {list.length ? (
              list.map((s, i) => (
                <View key={s.id} style={styles.song}>
                  <Text style={styles.num}>{String(i + 1).padStart(2, '0')}</Text>
                  <Pressable
                    style={{ flex: 1, gap: 2 }}
                    onPress={() => setDraft({ id: s.id, stage: s.stage, title: s.title, artist: s.artist ?? '', url: s.url ?? '', note: s.note ?? '' })}>
                    <Text variant="body" style={{ fontFamily: fonts.bodyMedium }} numberOfLines={1}>
                      {s.title}
                    </Text>
                    {s.artist || s.note ? (
                      <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
                        {[s.artist, s.note].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable accessibilityLabel="האזנה" hitSlop={6} onPress={() => listen(s)} style={styles.icon}>
                    <Feather name="play" size={14} color={colors.ink} />
                  </Pressable>
                  <View style={styles.order}>
                    <Pressable accessibilityLabel="למעלה" hitSlop={4} disabled={i === 0} onPress={() => move(stage.key, i, -1)}>
                      <Feather name="chevron-up" size={16} color={i === 0 ? colors.stone : colors.inkSoft} />
                    </Pressable>
                    <Pressable accessibilityLabel="למטה" hitSlop={4} disabled={i === list.length - 1} onPress={() => move(stage.key, i, 1)}>
                      <Feather name="chevron-down" size={16} color={i === list.length - 1 ? colors.stone : colors.inkSoft} />
                    </Pressable>
                  </View>
                </View>
              ))
            ) : (
              <Pressable onPress={() => setDraft({ stage: stage.key, title: '', artist: '', url: '', note: '' })} style={styles.empty}>
                <Text variant="caption" color={colors.inkMuted}>
                  עוד אין שירים לשלב הזה · הוספה
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Sheet
        visible={draft != null}
        onClose={() => setDraft(null)}
        eyebrow="פלייליסט"
        title={draft?.id ? 'עריכת שיר' : 'שיר חדש'}
        footer={
          <>
            {draft?.id ? (
              <Button
                variant="ghost"
                label="מחיקה"
                style={{ flex: 1 }}
                onPress={async () => {
                  if (draft?.id && (await confirm('מחיקת שיר', draft.title, 'מחיקה'))) {
                    await m.mutateAsync({ path: `/api/planning/playlist/${draft.id}`, method: 'DELETE' });
                    setDraft(null);
                  }
                }}
              />
            ) : null}
            <Button label="שמירה" style={{ flex: 2 }} loading={m.isPending} onPress={save} />
          </>
        }>
        {draft ? (
          <>
            <ChipGroup>
              {PLAYLIST_STAGES.map((s) => (
                <Chip key={s.key} label={s.label} selected={draft.stage === s.key} onPress={() => setDraft({ ...draft, stage: s.key })} />
              ))}
            </ChipGroup>
            <TextField label="שם השיר" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
            <TextField label="מבצע/ת" value={draft.artist} onChangeText={(artist) => setDraft({ ...draft, artist })} />
            <TextField
              label="קישור (YouTube / Spotify)"
              ltr
              autoCapitalize="none"
              keyboardType="url"
              value={draft.url}
              onChangeText={(url) => setDraft({ ...draft, url })}
            />
            <TextField label="הערה לדיג׳יי" value={draft.note} onChangeText={(note) => setDraft({ ...draft, note })} error={error} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { gap: 0 },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  add: { borderRadius: 15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
  song: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  num: { fontFamily: fonts.displayLight, fontSize: 16, color: colors.inkMuted, width: 24 },
  icon: { borderRadius: 15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
  order: { alignItems: 'center' },
  empty: { paddingVertical: space.md },
});
