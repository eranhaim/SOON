import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { VendorPage, type EditSection } from '@/components/VendorPage';
import { IconButton } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { notify } from '@/lib/confirm';
import { pickMedia, uploadFile, uploadImage } from '@/lib/upload';
import { useOwnVendor } from '@/lib/vendor-context';
import { atStart, colors, space } from '@/theme/tokens';

const MAX_GALLERY = 60;

/**
 * The vendor's business page exactly as couples see it, edited in place (Instagram-style):
 * every section has an edit control, and "+" in the portfolio uploads photos and videos.
 */
export default function Storefront() {
  const { vendor, mutate } = useOwnVendor();
  const [about, setAbout] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  function edit(section: EditSection) {
    const to: Record<Exclude<EditSection, 'about'>, Href> = {
      cover: '/vendor/portfolio',
      portfolio: '/vendor/portfolio',
      details: '/vendor/profile',
      packages: '/vendor/packages',
      faq: '/vendor/faq',
      availability: '/vendor/calendar',
    };
    if (section === 'about') setAbout(vendor.about ?? '');
    else router.push(to[section]);
  }

  async function addMedia() {
    const remaining = MAX_GALLERY - vendor.media.length;
    if (remaining <= 0) return notify('תיק העבודות מלא', `אפשר עד ${MAX_GALLERY} פריטים.`);
    const picked = (await pickMedia({ limit: remaining })).slice(0, remaining);
    if (!picked.length) return;
    let failed = 0;
    for (const [i, m] of picked.entries()) {
      setStatus(`מעלה ${i + 1}/${picked.length}`);
      try {
        const url =
          m.kind === 'video'
            ? await uploadFile(m.uri, 'vendor-video', m.mimeType ?? 'video/mp4')
            : await uploadImage(m.uri, 'vendor-gallery');
        await mutate('/api/vendors/me/media', { method: 'POST', json: { url, kind: m.kind } });
      } catch {
        failed++;
      }
    }
    setStatus(null);
    if (failed) notify('חלק מהקבצים לא הועלו', `${failed} מתוך ${picked.length} נכשלו. נסו שוב.`);
  }

  async function saveAbout() {
    if (about == null) return;
    setSaving(true);
    try {
      await mutate('/api/vendors/me', { method: 'PATCH', json: { about: about.trim() || null } });
      setAbout(null);
    } catch (err) {
      notify('השמירה נכשלה', errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={{ padding: 0, gap: 0 }}>
      <View style={styles.banner}>
        <Text variant="caption" color={colors.inverse} align="center">
          כך זוגות רואים את העמוד שלכם · לחצו על ״עריכה״ בכל אזור
        </Text>
      </View>
      <View>
        <VendorPage vendor={vendor} onEdit={edit} onAddMedia={addMedia} mediaStatus={status} />
        <View style={[styles.back, atStart(space.md)]}>
          <IconButton
            icon="chevron-right"
            label="חזרה"
            size={20}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/vendor/business'))}
          />
        </View>
      </View>

      <Sheet
        visible={about != null}
        onClose={() => setAbout(null)}
        eyebrow="עמוד העסק"
        title="אודות"
        footer={<Button label="שמירה" style={{ flex: 1 }} loading={saving} onPress={saveAbout} />}>
        <TextField
          label="ספרו לזוגות על העסק"
          multiline
          value={about ?? ''}
          onChangeText={setAbout}
          style={{ minHeight: 180, textAlignVertical: 'top' }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.accent, paddingVertical: space.sm, paddingHorizontal: space.md },
  back: { position: 'absolute', top: space.md },
});
