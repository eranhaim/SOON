/**
 * The vendor's public page (spec §5). One component serves three places:
 * couples viewing a vendor, the vendor's own preview (spec §9), and admin review.
 */
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatAgorot, formatPriceRange, regionLabel, type VendorPublicDTO } from '@soon/shared';

import { colors, hairline, space } from '@/theme/tokens';

import { Text } from './Text';
import { Card, Divider, SectionTitle, type IconName } from './ui';

export function VendorPage({ vendor, width }: { vendor: VendorPublicDTO; width?: number }) {
  const window = useWindowDimensions();
  const pageWidth = Math.min(width ?? window.width, 720);
  const priceRange = formatPriceRange(vendor.priceFromAgorot, vendor.priceToAgorot);

  return (
    <View style={{ width: '100%' }}>
      {/* Hero */}
      <View style={[styles.hero, { height: Math.round(pageWidth * 0.62) }]}>
        {vendor.coverUrl ? (
          <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
            <Feather name="image" size={28} color={colors.stoneDeep} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.identity}>
          <View style={styles.logo}>
            {vendor.logoUrl ? (
              <Image source={vendor.logoUrl} style={styles.logoImg} contentFit="cover" />
            ) : (
              <Text variant="h2" color={colors.inkSoft}>
                {vendor.businessName.slice(0, 1)}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 4, paddingTop: space.lg }}>
            <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 2 }}>
              {vendor.categoryLabel}
            </Text>
            <Text variant="h1">{vendor.businessName}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {vendor.regions.length ? (
            <Meta icon="map-pin" text={vendor.regions.map(regionLabel).join(' · ')} />
          ) : null}
          {priceRange ? <Meta icon="tag" text={priceRange} /> : null}
          <Meta icon="star" text="אין עדיין ביקורות" />
        </View>

        {/* Fixed actions (spec §5). Wired up in later phases. */}
        <View style={styles.actions}>
          <Action icon="heart" label="שמירה" />
          <Action icon="message-circle" label="הודעה" />
          <Action icon="calendar" label="בדיקת זמינות" />
          <Action icon="file-text" label="הצעת מחיר" />
        </View>

        {vendor.about ? (
          <View style={styles.section}>
            <SectionTitle>אודות</SectionTitle>
            <Text variant="body" color={colors.inkSoft}>
              {vendor.about}
            </Text>
          </View>
        ) : null}

        {vendor.media.length ? (
          <View style={styles.section}>
            <SectionTitle>תיק עבודות</SectionTitle>
            <Gallery urls={vendor.media.map((m) => m.url)} width={pageWidth - space.lg * 2} />
          </View>
        ) : null}

        {vendor.packages.length ? (
          <View style={styles.section}>
            <SectionTitle>חבילות ומחירים</SectionTitle>
            {vendor.packages.map((p) => (
              <Card key={p.id}>
                <View style={styles.pkgHead}>
                  <Text variant="h2" style={{ flex: 1 }}>
                    {p.name}
                  </Text>
                  {p.priceAgorot != null ? <Text variant="body">{formatAgorot(p.priceAgorot)}</Text> : null}
                </View>
                {p.description ? (
                  <Text variant="bodySmall" color={colors.inkSoft}>
                    {p.description}
                  </Text>
                ) : null}
                {p.includes.length ? (
                  <View style={{ gap: 6 }}>
                    {p.includes.map((line, i) => (
                      <View key={i} style={styles.includeRow}>
                        <Feather name="check" size={14} color={colors.ink} />
                        <Text variant="bodySmall" style={{ flex: 1 }}>
                          {line}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </View>
        ) : null}

        {vendor.faqs.length ? (
          <View style={styles.section}>
            <SectionTitle>שאלות נפוצות</SectionTitle>
            {vendor.faqs.map((f, i) => (
              <View key={f.id} style={{ gap: 4 }}>
                {i > 0 ? <Divider /> : null}
                <Text variant="body" style={{ fontFamily: 'Heebo_500Medium', marginTop: i > 0 ? space.md : 0 }}>
                  {f.question}
                </Text>
                <Text variant="bodySmall" color={colors.inkSoft}>
                  {f.answer}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {vendor.cancellationPolicy ? (
          <View style={styles.section}>
            <SectionTitle>מדיניות ביטול</SectionTitle>
            <Text variant="bodySmall" color={colors.inkSoft}>
              {vendor.cancellationPolicy}
            </Text>
          </View>
        ) : null}

        {vendor.instagramUrl || vendor.websiteUrl ? (
          <View style={[styles.section, styles.links]}>
            {vendor.instagramUrl ? <LinkOut icon="instagram" label="Instagram" url={vendor.instagramUrl} /> : null}
            {vendor.websiteUrl ? <LinkOut icon="globe" label="אתר" url={vendor.websiteUrl} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.meta}>
      <Feather name={icon} size={14} color={colors.inkSoft} />
      <Text variant="bodySmall" color={colors.inkSoft}>
        {text}
      </Text>
    </View>
  );
}

function Action({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.action} accessibilityLabel={`${label} (בקרוב)`}>
      <Feather name={icon} size={20} color={colors.ink} />
      <Text variant="caption" align="center">
        {label}
      </Text>
    </View>
  );
}

function LinkOut({ icon, label, url }: { icon: IconName; label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)} style={styles.linkOut}>
      <Feather name={icon} size={16} color={colors.ink} />
      <Text variant="bodySmall">{label}</Text>
    </Pressable>
  );
}

/** Editorial grid: first image wide, the rest in two columns. Tap opens a simple viewer. */
function Gallery({ urls, width }: { urls: string[]; width: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const gap = space.sm;
  const half = (width - gap) / 2;
  return (
    <>
      <View style={[styles.grid, { gap }]}>
        {urls.map((u, i) => {
          const w = i === 0 ? width : half;
          return (
            <Pressable key={u} onPress={() => setOpen(i)} accessibilityRole="imagebutton">
              <Image source={u} style={{ width: w, height: i === 0 ? width * 0.66 : half * 1.25 }} contentFit="cover" transition={150} />
            </Pressable>
          );
        })}
      </View>
      <Modal visible={open != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)} accessibilityLabel="סגירה">
          {open != null ? (
            <Image source={urls[open]} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', backgroundColor: colors.stone },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.lg, gap: space.lg },
  identity: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginTop: -38,
    backgroundColor: colors.offWhite,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.line,
    paddingVertical: space.md,
  },
  action: { flex: 1, alignItems: 'center', gap: 6, opacity: 0.55 },
  section: { gap: space.md },
  pkgHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  links: { flexDirection: 'row', gap: space.lg },
  linkOut: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.xs },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', padding: space.lg },
});
