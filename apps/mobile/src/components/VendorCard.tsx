import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatPriceRange, regionLabel, type VendorCardDTO } from '@soon/shared';

import { useToggleSave } from '@/lib/saved';
import { atEnd, atStart, colors, radius, space } from '@/theme/tokens';

import { Text } from './Text';

/** Saves at which a vendor counts as a "popular choice" tag (spec §5). */
const POPULAR_SAVES = 3;

type Props = {
  vendor: VendorCardDTO;
  /** 'full' = search results; 'compact' = horizontal carousels. */
  variant?: 'full' | 'compact';
  /** Extra line under the price (e.g. a saved note). */
  footnote?: string | null;
  onPress?: () => void;
};

/** Search-result card (spec §5): big image, name, category, regions, price, rating, tags, heart. */
export function VendorCard({ vendor: v, variant = 'full', footnote, onPress }: Props) {
  const toggleSave = useToggleSave();
  const compact = variant === 'compact';
  const price = formatPriceRange(v.priceFromAgorot, v.priceToAgorot);
  const tags = [
    v.availability === 'available' && { label: 'זמין בתאריך שלכם', dark: true },
    v.availability === 'booked' && { label: 'תפוס בתאריך שלכם', dark: false },
    v.isFeatured && { label: 'מומלץ', dark: false },
    v.saveCount >= POPULAR_SAVES && !v.isFeatured && { label: 'בחירה פופולרית', dark: false },
  ].filter(Boolean) as { label: string; dark: boolean }[];

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${v.businessName}, ${v.categoryLabel}`}
      onPress={onPress ?? (() => router.push({ pathname: '/v/[slug]', params: { slug: v.slug } }))}
      style={({ pressed }) => [compact ? styles.compact : styles.full, pressed && { opacity: 0.85 }]}>
      <View style={[styles.imageWrap, { aspectRatio: compact ? 1.2 : 1.45 }]}>
        {v.coverUrl ? (
          <Image source={v.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={v.id} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImage]}>
            <Feather name="image" size={24} color={colors.stoneDeep} />
          </View>
        )}
        {v.availability === 'booked' ? <View style={[StyleSheet.absoluteFill, styles.dim]} /> : null}
        <View style={[styles.tags, atStart(space.sm)]}>
          {tags.slice(0, compact ? 1 : 2).map((t) => (
            <View key={t.label} style={[styles.tag, t.dark && styles.tagDark]}>
              <Text variant="caption" color={t.dark ? colors.inverse : colors.ink} style={{ fontSize: 11 }}>
                {t.label}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={v.saved ? 'הסרה מהשמורים' : 'שמירה'}
          accessibilityState={{ selected: v.saved }}
          hitSlop={10}
          onPress={() => toggleSave(v.id, !v.saved)}
          style={[styles.heart, atEnd(space.sm)]}>
          <Feather name="heart" size={18} color={v.saved ? colors.inverse : colors.ink} />
          {v.saved ? <View style={styles.heartFill} /> : null}
        </Pressable>
      </View>

      <View style={{ gap: 2, paddingTop: space.sm }}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 1.5 }}>
          {v.categoryLabel}
        </Text>
        <View style={styles.titleRow}>
          <Text variant={compact ? 'body' : 'h2'} numberOfLines={1} style={{ flex: 1, fontFamily: compact ? 'Heebo_500Medium' : undefined }}>
            {v.businessName}
          </Text>
          {v.ratingAvg != null ? (
            <View style={styles.rating}>
              <Feather name="star" size={12} color={colors.ink} />
              <Text variant="bodySmall">{v.ratingAvg.toFixed(1)}</Text>
              <Text variant="caption" color={colors.inkMuted}>{`(${v.reviewCount})`}</Text>
            </View>
          ) : null}
        </View>
        {!compact && v.regions.length ? (
          <Text variant="bodySmall" color={colors.inkSoft} numberOfLines={1}>
            {v.regions.map(regionLabel).join(' · ')}
          </Text>
        ) : null}
        {price ? (
          <Text variant="bodySmall" color={colors.inkSoft} numberOfLines={1}>
            {price}
          </Text>
        ) : null}
        {footnote ? (
          <Text variant="caption" color={colors.inkMuted} numberOfLines={2}>
            {footnote}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  compact: { width: 220 },
  imageWrap: { width: '100%', backgroundColor: colors.stone, overflow: 'hidden', borderRadius: radius.sm },
  noImage: { alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: 'rgba(255,255,255,0.45)' },
  tags: { position: 'absolute', top: space.sm, flexDirection: 'row', gap: space.xs },
  tag: { backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  tagDark: { backgroundColor: colors.ink },
  heart: {
    position: 'absolute',
    top: space.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heartFill: { ...StyleSheet.absoluteFill, backgroundColor: colors.ink, zIndex: -1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
