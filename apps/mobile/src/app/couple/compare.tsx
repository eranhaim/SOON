import { useQueries } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { formatAgorot, formatPriceRange, regionLabel, type SavedVendorDTO, type VendorPublicDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { api } from '@/lib/api';
import { keys, useApiQuery } from '@/lib/query';
import { colors, hairline, space } from '@/theme/tokens';

const COL = 200;

/** Side-by-side comparison of 2–3 saved vendors (spec §6). */
export default function Compare() {
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const saved = useApiQuery<SavedVendorDTO[]>(keys.saved, '/api/saved');
  const cards = (saved.data ?? []).filter((v) => ids.split(',').includes(v.id)).slice(0, 3);
  const pages = useQueries({
    queries: cards.map((c) => ({ queryKey: keys.vendorPage(c.slug), queryFn: () => api<VendorPublicDTO>(`/api/vendors/${c.slug}`) })),
  });

  if (saved.isPending || pages.some((p) => p.isPending)) return <Loading />;
  if (cards.length < 2) {
    return (
      <Screen title="השוואה" back backTo="/couple/saved">
        <Text color={colors.inkSoft}>בחרו לפחות שני ספקים שמורים מאותה קטגוריה.</Text>
      </Screen>
    );
  }

  const rows: { label: string; value: (c: SavedVendorDTO, p?: VendorPublicDTO) => string }[] = [
    { label: 'מחיר', value: (c) => formatPriceRange(c.priceFromAgorot, c.priceToAgorot) || '—' },
    { label: 'דירוג', value: (c) => (c.ratingAvg != null ? `${c.ratingAvg.toFixed(1)} (${c.reviewCount} ביקורות)` : 'אין ביקורות') },
    { label: 'זמינות בתאריך שלכם', value: (c) => (c.availability === 'available' ? 'פנוי' : c.availability === 'booked' ? 'תפוס' : 'לא ידוע') },
    { label: 'אזורים', value: (c) => c.regions.map(regionLabel).join(', ') || '—' },
    {
      label: 'חבילות',
      value: (_c, p) => p?.packages.map((k) => `${k.name}${k.priceAgorot != null ? ` · ${formatAgorot(k.priceAgorot)}` : ''}`).join('\n') || '—',
    },
    { label: 'מה כלול', value: (_c, p) => [...new Set(p?.packages.flatMap((k) => k.includes) ?? [])].slice(0, 8).join('\n') || '—' },
    { label: 'מדיניות ביטול', value: (_c, p) => p?.cancellationPolicy ?? '—' },
    { label: 'ההערות שלכם', value: (c) => c.note ?? '—' },
  ];

  return (
    <Screen title="השוואת ספקים" back backTo="/couple/saved" maxWidth={1000}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.row}>
            <View style={styles.labelCol} />
            {cards.map((c) => (
              <View key={c.id} style={styles.col}>
                <Image source={c.coverUrl} style={styles.img} contentFit="cover" />
                <Text variant="body" style={{ fontFamily: 'Heebo_500Medium' }} numberOfLines={2}>
                  {c.businessName}
                </Text>
                <Button variant="outline" label="לעמוד הספק" onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: c.slug } })} style={{ minHeight: 40 }} />
              </View>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.label} style={[styles.row, styles.border]}>
              <View style={styles.labelCol}>
                <Text variant="caption" color={colors.inkSoft}>{r.label}</Text>
              </View>
              {cards.map((c, i) => (
                <View key={c.id} style={styles.col}>
                  <Text variant="bodySmall">{r.value(c, pages[i]?.data)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  border: { borderTopWidth: hairline, borderTopColor: colors.line },
  labelCol: { width: 110 },
  col: { width: COL, gap: space.sm },
  img: { width: COL, height: COL * 0.7, backgroundColor: colors.stone },
});
