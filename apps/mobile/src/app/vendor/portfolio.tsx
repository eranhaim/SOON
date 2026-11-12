import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { MIN_GALLERY_PHOTOS, type UploadPurpose } from '@soon/shared';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { IconButton, SectionTitle } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { confirm, notify } from '@/lib/confirm';
import { pickImages, uploadImage } from '@/lib/upload';
import { useOwnVendor } from '@/lib/vendor-context';
import { atEnd, colors, hairline, space } from '@/theme/tokens';

const MAX_GALLERY = 60;

/** Cover, logo and gallery (spec §9: gallery). */
export default function Portfolio() {
  const { vendor, mutate } = useOwnVendor();
  const window = useWindowDimensions();
  const width = Math.min(window.width, 720) - space.lg * 2;
  const tile = (width - space.sm * 2) / 3;
  const [busy, setBusy] = useState<null | 'cover' | 'logo' | { done: number; total: number }>(null);

  async function replaceSingle(kind: 'cover' | 'logo') {
    const [uri] = await pickImages();
    if (!uri) return;
    setBusy(kind);
    try {
      const purpose: UploadPurpose = kind === 'cover' ? 'vendor-cover' : 'vendor-logo';
      const url = await uploadImage(uri, purpose);
      await mutate('/api/vendors/me', { method: 'PATCH', json: kind === 'cover' ? { coverUrl: url } : { logoUrl: url } });
    } catch (err) {
      notify('ההעלאה נכשלה', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function addPhotos() {
    const remaining = MAX_GALLERY - vendor.media.length;
    const uris = await pickImages({ multiple: true, limit: remaining });
    if (!uris.length) return;
    const batch = uris.slice(0, remaining);
    let failed = 0;
    for (const [i, uri] of batch.entries()) {
      setBusy({ done: i, total: batch.length });
      try {
        const url = await uploadImage(uri, 'vendor-gallery');
        await mutate('/api/vendors/me/media', { method: 'POST', json: { url } });
      } catch {
        failed++;
      }
    }
    setBusy(null);
    if (failed) notify('חלק מהתמונות לא הועלו', `${failed} מתוך ${batch.length} נכשלו. נסו שוב.`);
  }

  async function remove(id: string) {
    if (!(await confirm('מחיקת תמונה', 'למחוק את התמונה מתיק העבודות?', 'מחיקה'))) return;
    try {
      await mutate(`/api/vendors/me/media/${id}`, { method: 'DELETE' });
    } catch (err) {
      notify('המחיקה נכשלה', errorMessage(err));
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const ids = vendor.media.map((m) => m.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    try {
      await mutate('/api/vendors/me/media/order', { method: 'PUT', json: { ids } });
    } catch (err) {
      notify('לא הצלחנו לשנות סדר', errorMessage(err));
    }
  }

  const uploading = typeof busy === 'object' && busy !== null;

  return (
    <Screen title="תיק עבודות" back backTo="/vendor/business">
      <View style={{ gap: space.sm }}>
        <SectionTitle>תמונת קאבר</SectionTitle>
        <Pressable onPress={() => replaceSingle('cover')} style={[styles.cover, { height: width * 0.56 }]} accessibilityRole="button">
          {vendor.coverUrl ? <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.overlay}>
            {busy === 'cover' ? (
              <ActivityIndicator color={colors.inverse} />
            ) : (
              <Text variant="label" color={vendor.coverUrl ? colors.inverse : colors.ink}>
                {vendor.coverUrl ? 'החלפת קאבר' : '+ הוספת תמונת קאבר'}
              </Text>
            )}
          </View>
        </Pressable>
        <Text variant="caption" color={colors.inkMuted}>
          התמונה הראשונה שזוגות רואים. מומלץ צילום רוחבי באיכות גבוהה.
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>לוגו</SectionTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable onPress={() => replaceSingle('logo')} style={styles.logo} accessibilityRole="button" accessibilityLabel="החלפת לוגו">
            {vendor.logoUrl ? <Image source={vendor.logoUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            {busy === 'logo' ? <ActivityIndicator color={colors.ink} /> : !vendor.logoUrl ? <Feather name="plus" size={22} color={colors.ink} /> : null}
          </Pressable>
          <Text variant="bodySmall" color={colors.inkSoft}>
            {vendor.logoUrl ? 'הקישו להחלפה' : 'לא חובה, אבל מוסיף מקצועיות'}
          </Text>
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <SectionTitle>{`גלריה · ${vendor.media.length}`}</SectionTitle>
        {vendor.media.length < MIN_GALLERY_PHOTOS ? (
          <Text variant="caption" color={colors.inkSoft}>
            {`נדרשות לפחות ${MIN_GALLERY_PHOTOS} תמונות לשליחה לאישור.`}
          </Text>
        ) : null}
        <View style={styles.grid}>
          {vendor.media.map((m, i) => (
            <View key={m.id} style={{ width: tile, height: tile }}>
              <Image source={m.url} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.tileTools}>
                <IconButton icon="x" label="מחיקה" size={14} tone="dark" onPress={() => remove(m.id)} />
              </View>
              <View style={styles.tileMove}>
                {i > 0 ? <IconButton icon="chevron-right" label="הקדמה" size={14} tone="dark" onPress={() => move(i, -1)} /> : <View />}
                {i < vendor.media.length - 1 ? (
                  <IconButton icon="chevron-left" label="הזזה אחורה" size={14} tone="dark" onPress={() => move(i, 1)} />
                ) : null}
              </View>
            </View>
          ))}
          {vendor.media.length < MAX_GALLERY ? (
            <Pressable
              onPress={addPhotos}
              disabled={uploading}
              accessibilityRole="button"
              style={[styles.addTile, { width: tile, height: tile }]}>
              {uploading ? (
                <>
                  <ActivityIndicator color={colors.ink} />
                  <Text variant="caption">{`${busy.done + 1} / ${busy.total}`}</Text>
                </>
              ) : (
                <>
                  <Feather name="plus" size={22} color={colors.ink} />
                  <Text variant="caption">הוספת תמונות</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', backgroundColor: colors.stone, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.offWhite,
    borderWidth: hairline,
    borderColor: colors.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tileTools: { position: 'absolute', top: 6, ...atEnd(6) },
  tileMove: { position: 'absolute', bottom: 6, left: 6, right: 6, flexDirection: 'row', justifyContent: 'space-between' },
  addTile: {
    borderWidth: hairline,
    borderStyle: 'dashed',
    borderColor: colors.stoneDeep,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: colors.offWhite,
  },
});
