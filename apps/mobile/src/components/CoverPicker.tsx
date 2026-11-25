import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { notify } from '@/lib/confirm';
import { keys, useApiMutation } from '@/lib/query';
import { pickImages, uploadImage } from '@/lib/upload';
import { colors, photo, radius, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Sheet } from './Sheet';
import { Text } from './Text';

/** Curated backgrounds for the couple home. Couples can also upload their own photo. */
export const COVER_PHOTOS = [
  '1519741497674-611481863552',
  '1511285560929-80b456fea0bc',
  '1465495976277-4387d4b0b4c6',
  '1522673607200-164d1b6ce486',
  '1507504031003-b417219a0fde',
  '1515934751635-c81c6bc9a2d8',
  '1532712938310-34cb3982ef74',
  '1469371670807-013ccf25f16a',
  '1583939003579-730e3918a45a',
  '1537633552985-df8429e8048b',
].map((id) => photo(id, 1400));

export const DEFAULT_COVER = COVER_PHOTOS[0]!;

export function CoverPicker({ visible, onClose, current }: { visible: boolean; onClose: () => void; current: string | null }) {
  const save = useApiMutation({ invalidate: [keys.home, keys.wedding] });
  const [uploading, setUploading] = useState(false);
  const selected = current ?? DEFAULT_COVER;
  /** The couple's own photo, shown first while it is the current background. */
  const own = current && !COVER_PHOTOS.includes(current) ? current : null;

  const choose = (url: string) =>
    save.mutate({ path: '/api/weddings/me', method: 'PATCH', json: { coverImageUrl: url } }, { onSuccess: onClose });

  async function fromGallery() {
    const [uri] = await pickImages();
    if (!uri) return;
    setUploading(true);
    try {
      choose(await uploadImage(uri, 'wedding-cover'));
    } catch {
      notify('ההעלאה נכשלה', 'בדקו את החיבור ונסו שוב.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="מסך הבית" title="תמונת רקע">
      <Text variant="bodySmall" color={colors.inkSoft} style={{ marginTop: -space.sm }}>
        בחרו תמונה מהגלריה שלכם, או אחת מהתמונות שלנו.
      </Text>
      <View style={styles.grid}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="העלאת תמונה מהגלריה"
          disabled={uploading}
          onPress={fromGallery}
          style={[styles.item, styles.upload]}>
          {uploading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Feather name="image" size={22} color={colors.accent} />
              <Text variant="caption" align="center" color={colors.accent}>
                מהגלריה
              </Text>
            </>
          )}
        </PressableScale>
        {[...(own ? [own] : []), ...COVER_PHOTOS].map((url) => {
          const on = url === selected;
          return (
            <PressableScale
              key={url}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel="בחירת תמונה"
              onPress={() => choose(url)}
              style={[styles.item, on && styles.itemOn]}>
              <Image source={url} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              {on ? (
                <View style={styles.check}>
                  <Feather name="check" size={14} color={colors.inverse} />
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  item: { width: '31.5%', aspectRatio: 0.8, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.stone },
  upload: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.accent,
  },
  itemOn: { borderWidth: 3, borderColor: colors.accent },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
