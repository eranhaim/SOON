/**
 * The vendor's page (spec §5). One component serves four places: couples viewing a vendor,
 * admin review, and — with `onEdit` — the vendor's own page, edited in place (every section
 * gets an edit control, empty sections show what to add).
 */
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState, type ReactNode } from 'react';
import { Linking, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatAgorot, formatPriceRange, regionLabel, type ReviewDTO, type VendorMediaDTO, type VendorPublicDTO } from '@soon/shared';

import { formatDate } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { atEnd, colors, fonts, hairline, radius, space } from '@/theme/tokens';

import { Text } from './Text';
import { Divider, type IconName } from './ui';

export type VendorAction = 'save' | 'message' | 'availability' | 'quote';
export type EditSection = 'cover' | 'details' | 'about' | 'portfolio' | 'packages' | 'faq' | 'availability';

type Props = {
  vendor: VendorPublicDTO;
  /** Wires the fixed action bar (spec §5). Without it the bar renders inert (previews, admin). */
  onAction?: (action: VendorAction) => void;
  saved?: boolean;
  /** Owner mode: tap a section to edit it. */
  onEdit?: (section: EditSection) => void;
  /** Owner mode: the "+" in the portfolio. */
  onAddMedia?: () => void;
  /** Owner mode: upload progress text shown in the portfolio. */
  mediaStatus?: string | null;
  /** Extra sections at the end. */
  footer?: ReactNode;
};

export function VendorPage({ vendor, onAction, saved, onEdit, onAddMedia, mediaStatus, footer }: Props) {
  const window = useWindowDimensions();
  // Measure the real container width (the page can sit in a narrow column, e.g. admin review).
  const [measured, setMeasured] = useState<number | null>(null);
  const pageWidth = measured ?? Math.min(window.width, 720);
  const priceRange = formatPriceRange(vendor.priceFromAgorot, vendor.priceToAgorot);
  const reviews = useApiQuery<ReviewDTO[]>(keys.reviews(vendor.slug), `/api/vendors/${encodeURIComponent(vendor.slug)}/reviews`);
  const owner = Boolean(onEdit);

  return (
    <View style={{ width: '100%' }} onLayout={(e) => setMeasured(Math.round(e.nativeEvent.layout.width))}>
      {/* Hero */}
      <View style={[styles.hero, { height: Math.round(pageWidth * 0.62) }]}>
        {vendor.coverUrl ? (
          <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.heroEmpty]}>
            <Feather name="image" size={28} color={colors.stoneDeep} />
          </View>
        )}
        {owner ? (
          <Pressable onPress={() => onEdit!('cover')} style={[styles.heroEdit, atEnd(space.md)]} accessibilityRole="button">
            <Feather name="camera" size={14} color={colors.ink} />
            <Text variant="caption" style={{ fontFamily: fonts.bodyMedium }}>
              קאבר ולוגו
            </Text>
          </Pressable>
        ) : null}
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
            <Text variant="eyebrow" color={colors.inkMuted}>
              {vendor.categoryLabel}
            </Text>
            <Text variant="h1">{vendor.businessName}</Text>
          </View>
          {owner ? <EditButton label="פרטי העסק" onPress={() => onEdit!('details')} /> : null}
        </View>

        <View style={styles.metaRow}>
          {vendor.regions.length ? <Meta icon="map-pin" text={vendor.regions.map(regionLabel).join(' · ')} /> : null}
          {priceRange ? <Meta icon="tag" text={priceRange} /> : null}
          <Meta
            icon="star"
            text={vendor.ratingAvg != null ? `${vendor.ratingAvg.toFixed(1)} · ${vendor.reviewCount} ביקורות` : 'אין עדיין ביקורות'}
          />
        </View>

        {/* Fixed actions (spec §5). */}
        <View style={styles.actions}>
          <Action icon="heart" label={saved ? 'נשמר' : 'שמירה'} active={saved} onPress={onAction && (() => onAction('save'))} />
          <Action icon="message-circle" label="הודעה" onPress={onAction && (() => onAction('message'))} />
          <Action icon="calendar" label="בדיקת זמינות" onPress={onAction && (() => onAction('availability'))} />
          <Action icon="file-text" label="הצעת מחיר" onPress={onAction && (() => onAction('quote'))} />
        </View>

        {/* Portfolio first: it sells. */}
        {vendor.media.length || owner ? (
          <Section
            title="תיק עבודות"
            meta={owner ? `${vendor.media.length} פריטים` : undefined}
            edit={owner ? () => onEdit!('portfolio') : undefined}
            editLabel="ניהול וסידור">
            <Gallery
              media={vendor.media}
              width={pageWidth - space.lg * 2}
              onAdd={onAddMedia}
              status={mediaStatus}
            />
          </Section>
        ) : null}

        {vendor.about || owner ? (
          <Section title="אודות" edit={owner ? () => onEdit!('about') : undefined}>
            {vendor.about ? (
              <Text variant="body" color={colors.inkSoft}>
                {vendor.about}
              </Text>
            ) : (
              <Placeholder text="ספרו לזוגות מי אתם ומה מייחד אתכם" onPress={() => onEdit!('about')} />
            )}
          </Section>
        ) : null}

        {vendor.packages.length || owner ? (
          <Section title="חבילות ומחירים" edit={owner ? () => onEdit!('packages') : undefined}>
            {vendor.packages.length ? (
              vendor.packages.map((p) => (
                <View key={p.id} style={styles.pkg}>
                  <View style={styles.pkgHead}>
                    <Text variant="h2" style={{ flex: 1 }}>
                      {p.name}
                    </Text>
                    {p.priceAgorot != null ? <Text style={styles.price}>{formatAgorot(p.priceAgorot)}</Text> : null}
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
                </View>
              ))
            ) : (
              <Placeholder text="הוסיפו חבילה עם מחיר ומה היא כוללת" onPress={() => onEdit!('packages')} />
            )}
          </Section>
        ) : null}

        {reviews.data?.length || owner ? (
          <Section title="ביקורות והמלצות" meta={vendor.reviewCount ? `${vendor.reviewCount} ביקורות` : undefined}>
            {reviews.data?.length ? (
              reviews.data.slice(0, owner ? 3 : 6).map((r, i) => (
                <View key={r.id} style={{ gap: 6 }}>
                  {i > 0 ? <Divider /> : null}
                  <View style={[styles.reviewHead, i > 0 && { marginTop: space.md }]}>
                    <Text variant="body" style={{ fontFamily: fonts.bodyMedium, flex: 1 }}>
                      {r.author}
                    </Text>
                    <Text variant="caption">{'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</Text>
                  </View>
                  <Text variant="bodySmall" color={colors.inkSoft}>
                    {r.body}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {[r.verified ? 'עבדו עם העסק דרך SOON' : null, formatDate(r.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="bodySmall" color={colors.inkMuted}>
                ביקורות מופיעות כאן אחרי שזוגות שעבדו איתכם כותבים אותן.
              </Text>
            )}
          </Section>
        ) : null}

        {vendor.faqs.length || owner ? (
          <Section title="שאלות נפוצות" edit={owner ? () => onEdit!('faq') : undefined}>
            {vendor.faqs.length ? (
              vendor.faqs.map((f, i) => (
                <View key={f.id} style={{ gap: 4 }}>
                  {i > 0 ? <Divider /> : null}
                  <Text variant="body" style={{ fontFamily: fonts.bodyMedium, marginTop: i > 0 ? space.md : 0 }}>
                    {f.question}
                  </Text>
                  <Text variant="bodySmall" color={colors.inkSoft}>
                    {f.answer}
                  </Text>
                </View>
              ))
            ) : (
              <Placeholder text="הוסיפו תשובות לשאלות שזוגות שואלים תמיד" onPress={() => onEdit!('faq')} />
            )}
          </Section>
        ) : null}

        {owner ? (
          <Section title="זמינות" edit={() => onEdit!('availability')} editLabel="ליומן">
            <Text variant="bodySmall" color={colors.inkSoft}>
              זוגות רואים אם אתם פנויים בתאריך שלהם לפי היומן. עדכנו בו אירועים, פגישות וימים חסומים.
            </Text>
          </Section>
        ) : null}

        {vendor.cancellationPolicy ? (
          <Section title="מדיניות ביטול">
            <Text variant="bodySmall" color={colors.inkSoft}>
              {vendor.cancellationPolicy}
            </Text>
          </Section>
        ) : null}

        {vendor.instagramUrl || vendor.websiteUrl ? (
          <View style={[styles.section, styles.links]}>
            {vendor.instagramUrl ? <LinkOut icon="instagram" label="Instagram" url={vendor.instagramUrl} /> : null}
            {vendor.websiteUrl ? <LinkOut icon="globe" label="אתר" url={vendor.websiteUrl} /> : null}
          </View>
        ) : null}
        {footer}
      </View>
    </View>
  );
}

function Section({
  title,
  meta,
  edit,
  editLabel = 'עריכה',
  children,
}: {
  title: string;
  meta?: string;
  edit?: () => void;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="h2" style={{ flex: 1 }}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" color={colors.inkMuted}>
            {meta}
          </Text>
        ) : null}
        {edit ? <EditButton label={editLabel} onPress={edit} /> : null}
      </View>
      {children}
    </View>
  );
}

function EditButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.edit, pressed && { opacity: 0.6 }]}>
      <Feather name="edit-2" size={12} color={colors.ink} />
      <Text variant="caption" style={{ fontFamily: fonts.bodyMedium }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Placeholder({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.placeholder}>
      <Feather name="plus" size={16} color={colors.inkSoft} />
      <Text variant="bodySmall" color={colors.inkSoft}>
        {text}
      </Text>
    </Pressable>
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

function Action({ icon, label, onPress, active }: { icon: IconName; label: string; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
      <View style={[styles.actionIcon, active && { backgroundColor: colors.ink }]}>
        <Feather name={icon} size={20} color={active ? colors.inverse : colors.ink} />
      </View>
      <Text variant="caption" align="center">
        {label}
      </Text>
    </Pressable>
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

/** Instagram-like grid: three square tiles per row; videos marked with a play icon. */
function Gallery({
  media,
  width,
  onAdd,
  status,
}: {
  media: VendorMediaDTO[];
  width: number;
  onAdd?: () => void;
  status?: string | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const gap = 3;
  const tile = Math.floor((width - gap * 2) / 3);
  const current = open != null ? media[open] : null;
  return (
    <>
      <View style={[styles.grid, { gap }]}>
        {onAdd ? (
          <Pressable onPress={onAdd} accessibilityRole="button" accessibilityLabel="הוספת תמונות וסרטונים" style={[styles.addTile, { width: tile, height: tile }]}>
            <Feather name="plus" size={26} color={colors.ink} />
            <Text variant="caption" align="center">
              {status ?? 'הוספה'}
            </Text>
          </Pressable>
        ) : null}
        {media.map((m, i) => (
          <Pressable key={m.id} onPress={() => setOpen(i)} accessibilityRole="imagebutton">
            {m.kind === 'video' ? (
              <View style={[styles.videoTile, { width: tile, height: tile }]}>
                <Feather name="play" size={24} color={colors.inverse} />
              </View>
            ) : (
              <Image source={m.url} style={{ width: tile, height: tile }} contentFit="cover" transition={150} />
            )}
          </Pressable>
        ))}
      </View>
      <Modal visible={current != null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.viewer} onPress={() => setOpen(null)} accessibilityLabel="סגירה">
          {current?.kind === 'video' ? (
            <VideoViewer url={current.url} />
          ) : current ? (
            <Image source={current.url} style={{ width: '100%', height: '100%' }} contentFit="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

function VideoViewer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="contain" nativeControls />;
}

const styles = StyleSheet.create({
  hero: { width: '100%', backgroundColor: colors.stone },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  heroEdit: {
    position: 'absolute',
    bottom: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  body: { paddingHorizontal: space.lg, gap: space.xl, paddingBottom: space.xl },
  identity: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginTop: -40,
    backgroundColor: colors.offWhite,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: -space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: hairline,
    borderBottomWidth: hairline,
    borderColor: colors.line,
    paddingVertical: space.md,
  },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  section: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.ink },
  edit: { borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.line },
  placeholder: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.offWhite },
  pkg: { gap: space.sm, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  pkgHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  price: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  includeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  addTile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.offWhite, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed' },
  videoTile: { backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', gap: space.lg },
  linkOut: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.xs },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', padding: space.lg },
});

