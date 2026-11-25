import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { BoardDTO, SavedVendorDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { PressableScale, Reveal } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { VendorCard } from '@/components/VendorCard';
import { Chip, EmptyState } from '@/components/ui';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

type Tab = 'boards' | 'vendors';

/** Saved (spec §6): inspiration boards, and saved vendors with "compare". Shared by both partners. */
export default function Saved() {
  const [tab, setTab] = useState<Tab>('boards');
  const boards = useApiQuery<BoardDTO[]>(keys.boards, '/api/boards');
  const saved = useApiQuery<SavedVendorDTO[]>(keys.saved, '/api/saved');
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;

  return (
    <Screen
      eyebrow="הכל במקום אחד"
      title="שמורים"
      maxWidth={1100}
      refreshing={boards.isRefetching || saved.isRefetching}
      onRefresh={() => {
        void boards.refetch();
        void saved.refetch();
      }}>
      <Segmented
        options={[
          { key: 'boards', label: `לוחות השראה${boards.data ? ` · ${boards.data.length}` : ''}` },
          { key: 'vendors', label: `ספקים${saved.data ? ` · ${saved.data.length}` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'boards' ? <Boards q={boards} cols={cols} /> : <Vendors q={saved} cols={cols} />}
    </Screen>
  );
}

function Boards({ q, cols }: { q: ReturnType<typeof useApiQuery<BoardDTO[]>>; cols: number }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const create = useApiMutation<BoardDTO[]>({ setData: keys.boards });
  if (q.isPending) return <Loading />;
  const list = q.data ?? [];
  const w = `${(100 - (cols - 1) * 3.5) / cols}%` as const;

  return (
    <View style={styles.grid}>
      {list.map((b, i) => (
        <Reveal key={b.id} index={i} style={{ width: w }}>
          <PressableScale scaleTo={0.97} onPress={() => router.push({ pathname: '/couple/board/[id]', params: { id: b.id } })}>
            <View style={styles.boardImage}>
              {b.coverUrl ? <Image source={b.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
              <LinearGradient colors={['rgba(36,18,15,0)', 'rgba(36,18,15,0.55)']} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.boardCount}>
                <Feather name="image" size={11} color={colors.ink} />
                <Text variant="caption" style={{ fontFamily: fonts.bodyMedium, fontSize: 11 }}>
                  {b.itemCount}
                </Text>
              </View>
            </View>
            <Text variant="h3" style={{ fontFamily: fonts.displayMedium, fontSize: 18, marginTop: space.sm }} numberOfLines={1}>
              {b.title}
            </Text>
            <Text variant="caption" color={colors.inkMuted}>
              {b.itemCount === 1 ? 'פריט אחד' : `${b.itemCount} פריטים`}
            </Text>
          </PressableScale>
        </Reveal>
      ))}
      <Reveal index={list.length} style={{ width: w }}>
        <PressableScale scaleTo={0.97} onPress={() => setAdding(true)} style={[styles.boardImage, styles.newBoard]}>
          <View style={styles.plus}>
            <Feather name="plus" size={22} color={colors.accent} />
          </View>
          <Text variant="label" color={colors.accent}>
            לוח חדש
          </Text>
        </PressableScale>
      </Reveal>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        eyebrow="לוחות השראה"
        title="לוח חדש"
        footer={
          <Button
            label="יצירה"
            style={{ flex: 1 }}
            disabled={!title.trim()}
            loading={create.isPending}
            onPress={() =>
              create.mutate(
                { path: '/api/boards', json: { title: title.trim() } },
                { onSuccess: () => (setTitle(''), setAdding(false)) },
              )
            }
          />
        }>
        <TextField label="שם הלוח" placeholder="למשל: הזמנות, חופה, שמלת ערב" value={title} onChangeText={setTitle} />
      </Sheet>
    </View>
  );
}

function Vendors({ q, cols }: { q: ReturnType<typeof useApiQuery<SavedVendorDTO[]>>; cols: number }) {
  const [category, setCategory] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  const all = q.data ?? [];
  if (!all.length) {
    return (
      <EmptyState
        icon="heart"
        title="עוד לא שמרתם ספקים"
        body="לחצו על הלב בכל ספק שאהבתם כדי לחזור אליו ולהשוות."
        action={<Button label="לחיפוש ספקים" onPress={() => router.push('/couple/explore')} style={{ marginTop: space.md }} />}
      />
    );
  }
  const cats = [...new Map(all.map((v) => [v.categorySlug, v.categoryLabel])).entries()];
  const shown = category ? all.filter((v) => v.categorySlug === category) : all;
  const w = `${(100 - (cols - 1) * 3.5) / cols}%` as const;

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="הכל" count={all.length} selected={!category} onPress={() => setCategory(null)} />
        {cats.map(([slug, label]) => (
          <Chip key={slug} label={label} count={all.filter((v) => v.categorySlug === slug).length} selected={category === slug} onPress={() => setCategory(slug)} />
        ))}
      </View>
      {category && shown.length >= 2 ? (
        <Button
          variant="soft"
          icon="columns"
          label={`השוואת ${Math.min(shown.length, 3)} ספקים`}
          onPress={() => router.push({ pathname: '/couple/compare', params: { ids: shown.slice(0, 3).map((v) => v.id).join(',') } })}
        />
      ) : null}
      <View style={styles.grid}>
        {shown.map((v, i) => (
          <Reveal key={v.id} index={i} style={{ width: w }}>
            <VendorCard vendor={v} variant="grid" footnote={v.note} />
          </Reveal>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  boardImage: { width: '100%', aspectRatio: 0.85, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.stone, ...shadow.sm },
  boardCount: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  newBoard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.25)',
    boxShadow: 'none',
  },
  plus: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
