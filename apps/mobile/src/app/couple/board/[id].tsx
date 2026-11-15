import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BoardDetailDTO, BoardDTO, SavedVendorDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { COVER_PHOTOS } from '@/components/CoverPicker';
import { PressableScale, Reveal } from '@/components/motion';
import { Loading, Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { EmptyState, IconButton } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { keys, useApiMutation, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

/** One inspiration board: a two-column photo wall, each picture optionally linked to its vendor. */
export default function Board() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useApiQuery<BoardDetailDTO>(keys.board(id), `/api/boards/${id}`);
  const remove = useApiMutation<BoardDetailDTO>({ setData: keys.board(id), invalidate: [keys.boards] });
  const delBoard = useApiMutation<BoardDTO[]>({ setData: keys.boards });
  const [adding, setAdding] = useState(false);

  if (q.isPending || !q.data) return <Loading />;
  const b = q.data;
  const left = b.items.filter((_, i) => i % 2 === 0);
  const right = b.items.filter((_, i) => i % 2 === 1);

  const column = (items: BoardDetailDTO['items'], offset: number) => (
    <View style={{ flex: 1, gap: space.md }}>
      {items.map((it, i) => (
        <Reveal key={it.id} index={i * 2 + offset}>
          <View style={[styles.pic, { aspectRatio: (i + offset) % 3 === 0 ? 0.72 : 0.95 }]}>
            <Image source={it.imageUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
            <View style={styles.picActions}>
              <IconButton
                icon="x"
                label="הסרה מהלוח"
                size={14}
                tone="dark"
                onPress={() => remove.mutate({ path: `/api/boards/${id}/items/${it.id}`, method: 'DELETE' })}
              />
            </View>
            {it.vendor ? (
              <PressableScale
                onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: it.vendor!.slug } })}
                style={styles.vendorTag}>
                <Text variant="caption" style={{ fontFamily: fonts.bodyMedium }} numberOfLines={1}>
                  {it.vendor.businessName}
                </Text>
                <Feather name="chevron-left" size={12} color={colors.ink} />
              </PressableScale>
            ) : null}
          </View>
        </Reveal>
      ))}
    </View>
  );

  return (
    <Screen
      back
      backTo="/couple/saved"
      title={b.title}
      subtitle={b.itemCount === 1 ? 'פריט אחד' : `${b.itemCount} פריטים`}
      right={<Button label="הוספה" icon="plus" size="sm" onPress={() => setAdding(true)} />}>
      {b.items.length ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {column(left, 0)}
          {column(right, 1)}
        </View>
      ) : (
        <EmptyState
          icon="image"
          title="הלוח עוד ריק"
          body="הוסיפו תמונות שאהבתם מהספקים או מגלריית ההשראה."
          action={<Button label="הוספת תמונות" icon="plus" onPress={() => setAdding(true)} style={{ marginTop: space.md }} />}
        />
      )}

      <Button
        variant="ghost"
        label="מחיקת הלוח"
        icon="trash-2"
        onPress={async () => {
          if (await confirm('מחיקת הלוח', `למחוק את "${b.title}" ואת כל התמונות שבו?`)) {
            delBoard.mutate({ path: `/api/boards/${id}`, method: 'DELETE' }, { onSuccess: () => router.back() });
          }
        }}
      />

      <AddSheet boardId={id} visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}

/** Pick pictures from saved vendors' covers or from the inspiration gallery. */
function AddSheet({ boardId, visible, onClose }: { boardId: string; visible: boolean; onClose: () => void }) {
  const saved = useApiQuery<SavedVendorDTO[]>(keys.saved, '/api/saved');
  const add = useApiMutation<BoardDetailDTO>({ setData: keys.board(boardId), invalidate: [keys.boards] });
  const fromVendors = (saved.data ?? []).filter((v) => v.coverUrl).map((v) => ({ url: v.coverUrl!, vendorId: v.id, label: v.businessName }));
  const gallery = COVER_PHOTOS.map((url) => ({ url, vendorId: null as string | null, label: null as string | null }));

  const grid = (items: { url: string; vendorId: string | null; label: string | null }[]) => (
    <View style={styles.pickGrid}>
      {items.map((p) => (
        <PressableScale
          key={p.url}
          accessibilityLabel={p.label ?? 'תמונת השראה'}
          onPress={() => add.mutate({ path: `/api/boards/${boardId}/items`, json: { imageUrl: p.url, vendorId: p.vendorId } }, { onSuccess: onClose })}
          style={styles.pick}>
          <Image source={p.url} style={StyleSheet.absoluteFill} contentFit="cover" />
          {p.label ? (
            <View style={styles.pickLabel}>
              <Text variant="caption" color={colors.inverse} numberOfLines={1} style={{ fontSize: 10 }}>
                {p.label}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      ))}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="הוספה ללוח" title="בחרו תמונה">
      {fromVendors.length ? (
        <>
          <Text variant="label">מהספקים ששמרתם</Text>
          {grid(fromVendors)}
        </>
      ) : null}
      <Text variant="label">גלריית השראה</Text>
      {grid(gallery)}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pic: { width: '100%', borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.stone, ...shadow.sm },
  picActions: { position: 'absolute', top: 8, left: 8 },
  vendorTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    maxWidth: '85%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pick: { width: '31.5%', aspectRatio: 0.85, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.stone },
  pickLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 4, backgroundColor: 'rgba(36,18,15,0.55)' },
});
