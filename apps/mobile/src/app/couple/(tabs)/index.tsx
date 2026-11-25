import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAgorot, formatHebrewDate, VENDOR_CATEGORIES, type CoupleHomeDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { CoverPicker, DEFAULT_COVER } from '@/components/CoverPicker';
import { PressableScale, Reveal, useCountUp } from '@/components/motion';
import { ProgressBar } from '@/components/Progress';
import { Logo } from '@/components/Logo';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VendorCard } from '@/components/VendorCard';
import { SectionTitle } from '@/components/ui';
import { formatDateTime, formatDayDots } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Couple home (spec §4): photo hero with countdown, progress tiles, nudges, personal feed. */
export default function CoupleHome() {
  const insets = useSafeAreaInsets();
  const q = useApiQuery<CoupleHomeDTO>(keys.home, '/api/couple/home');
  const [coverOpen, setCoverOpen] = useState(false);
  const days = useCountUp(q.data?.daysToGo ?? 0);

  if (q.isPending) return <Loading />;
  if (q.isError) {
    return (
      <Screen title="לא הצלחנו לטעון">
        <Button label="נסו שוב" onPress={() => q.refetch()} />
      </Screen>
    );
  }
  const h = q.data;
  const w = h.wedding;
  const closedSet = new Set(w.categories.filter((c) => c.status === 'closed').map((c) => c.slug));
  const vendorsTotal = h.vendors.closed + h.vendors.needed;
  const tasksTotal = h.tasks.open + h.tasks.done;
  const budgetTotal = h.budget.totalAgorot ?? 0;
  const availableOnDate = h.recommended.filter((v) => v.availability !== 'booked');

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent} />}>
        {/* ---- Photo hero ---- */}
        <View style={styles.hero}>
          <Image source={w.coverImageUrl ?? DEFAULT_COVER} style={StyleSheet.absoluteFill} contentFit="cover" transition={500} />
          <LinearGradient
            colors={['rgba(36,18,15,0.45)', 'rgba(36,18,15,0)', 'rgba(36,18,15,0.15)', 'rgba(36,18,15,0.82)']}
            locations={[0, 0.25, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + space.md }]}>
            <Logo variant="symbol" size={34} color={colors.inverse} />
            <View style={styles.heroActions}>
              <GlassButton icon="message-circle" label="הודעות" onPress={() => router.push('/messages' as Href)} />
              <GlassButton icon="camera" label="תמונת רקע" onPress={() => setCoverOpen(true)} />
            </View>
          </View>

          <View style={styles.heroText}>
            {h.daysToGo != null && h.daysToGo >= 0 ? (
              <Reveal>
                <Text variant="eyebrow" align="center" color={colors.inverse} style={styles.count}>
                  {h.daysToGo === 0 ? 'היום!' : h.daysToGo === 1 ? 'נותר יום אחד' : `נותרו ${days} ימים`}
                </Text>
              </Reveal>
            ) : null}
            <Reveal index={1}>
              <Text align="center" color="rgba(255,255,255,0.85)" style={styles.of}>
                החתונה של
              </Text>
              <Text align="center" color={colors.inverse} style={styles.names}>
                {`${w.partner1Name} ו${w.partner2Name}`}
              </Text>
            </Reveal>
            <Reveal index={2}>
              <Text align="center" color={colors.inverse} style={styles.date}>
                {w.weddingDate ? formatDayDots(w.weddingDate) : 'התאריך עוד לא נקבע'}
              </Text>
              {w.weddingDate ? (
                <Text align="center" color="rgba(255,255,255,0.8)" style={styles.hebDate}>
                  {[formatHebrewDate(w.weddingDate), w.venueName].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
            </Reveal>
          </View>
        </View>

        <View style={styles.body}>
          {/* ---- Progress tiles (spec §4: Budget, Vendors, Tasks, Next Event) ---- */}
          <Reveal index={3} style={styles.tilesCard}>
            <View style={styles.tilesRow}>
              <Tile
                label="תקציב"
                value={formatAgorot(h.budget.committedAgorot)}
                of={budgetTotal ? `מתוך ${formatAgorot(budgetTotal)}` : 'הגדירו תקציב'}
                progress={budgetTotal ? h.budget.committedAgorot / budgetTotal : 0}
                href="/couple/planning/budget"
              />
              <View style={styles.vRule} />
              <Tile
                label="ספקים"
                value={String(h.vendors.closed)}
                of={`מתוך ${vendorsTotal} נסגרו`}
                progress={vendorsTotal ? h.vendors.closed / vendorsTotal : 0}
                href="/couple/planning/vendors"
              />
            </View>
            <View style={styles.hRule} />
            <View style={styles.tilesRow}>
              <Tile
                label="משימות"
                value={String(h.tasks.done)}
                of={`מתוך ${tasksTotal} הושלמו`}
                progress={tasksTotal ? h.tasks.done / tasksTotal : 0}
                href="/couple/planning/checklist"
              />
              <View style={styles.vRule} />
              <Tile
                label="האירוע הבא"
                title={h.nextEvent?.title ?? (h.tasks.next ? `תזכורת: ${h.tasks.next.title}` : 'אין אירועים קרובים')}
                of={h.nextEvent ? formatDateTime(h.nextEvent.startsAt) : ''}
                href="/couple/planning/calendar"
              />
            </View>
          </Reveal>

          {/* ---- Nudges ---- */}
          {h.insights.length ? (
            <View style={{ gap: space.sm }}>
              {h.insights.slice(0, 3).map((i, n) => (
                <Reveal key={i.key} index={n + 4}>
                  <PressableScale
                    disabled={!i.href}
                    onPress={() => i.href && router.push(i.href as Href)}
                    style={styles.insight}>
                    <View style={styles.insightIcon}>
                      <Feather name="arrow-left" size={14} color={colors.ink} />
                    </View>
                    <Text variant="bodySmall" style={{ flex: 1 }}>
                      {i.text}
                    </Text>
                    {i.href ? <Feather name="chevron-left" size={16} color={colors.stoneDeep} /> : null}
                  </PressableScale>
                </Reveal>
              ))}
            </View>
          ) : null}

          {availableOnDate.length ? (
            <Carousel eyebrow="מומלצים עבורכם" title="פנויים בתאריך שלכם" items={availableOnDate} />
          ) : null}

          {/* ---- Categories still open ---- */}
          <View style={{ gap: space.md }}>
            <SectionTitle eyebrow="מה עוד חסר">קטגוריות לסגירה</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {VENDOR_CATEGORIES.filter((c) => !closedSet.has(c.slug)).map((c) => (
                <PressableScale
                  key={c.slug}
                  scaleTo={0.94}
                  onPress={() => router.push({ pathname: '/couple/explore', params: { category: c.slug } })}
                  style={styles.cat}>
                  <Text variant="bodySmall" style={{ fontFamily: fonts.bodyMedium }}>
                    {c.he}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>

          {h.fresh.length ? <Carousel eyebrow="הצטרפו לאחרונה" title="חדשים ב־SOON" items={h.fresh} /> : null}
        </View>
      </ScrollView>

      <CoverPicker visible={coverOpen} onClose={() => setCoverOpen(false)} current={w.coverImageUrl} />
    </View>
  );
}

function GlassButton({ icon, label, onPress }: { icon: 'camera' | 'message-circle'; label: string; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.9} onPress={onPress} style={styles.glass}>
      <Feather name={icon} size={18} color={colors.ink} />
    </PressableScale>
  );
}

function Tile({
  label,
  value,
  of,
  title,
  progress,
  href,
}: {
  label: string;
  value?: string;
  of: string;
  title?: string;
  progress?: number;
  href: Href;
}) {
  return (
    <PressableScale scaleTo={0.97} onPress={() => router.push(href)} style={styles.tile}>
      <Text variant="eyebrow" color={colors.gold} style={{ letterSpacing: 1.5 }}>
        {label}
      </Text>
      {value != null ? (
        <View style={{ minHeight: 50 }}>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </Text>
          <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
            {of}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 2, minHeight: 44, justifyContent: 'center' }}>
          <Text variant="bodySmall" numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
            {title}
          </Text>
          {of ? (
            <Text variant="caption" color={colors.inkMuted}>
              {of}
            </Text>
          ) : null}
        </View>
      )}
      {progress != null ? <ProgressBar value={progress} delay={400} /> : null}
    </PressableScale>
  );
}

function Carousel({ eyebrow, title, items }: { eyebrow: string; title: string; items: CoupleHomeDTO['recommended'] }) {
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle
        eyebrow={eyebrow}
        action={
          <PressableScale onPress={() => router.push('/couple/explore')} style={{ paddingVertical: 4 }}>
            <Text variant="caption" color={colors.accent} style={{ fontFamily: fonts.bodyMedium }}>
              לכל הספקים
            </Text>
          </PressableScale>
        }>
        {title}
      </SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        {items.map((v) => (
          <VendorCard key={v.id} vendor={v} variant="compact" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { height: 520, overflow: 'hidden', backgroundColor: colors.night },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  heroActions: { flexDirection: 'row', gap: space.sm },
  glass: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { position: 'absolute', left: 0, right: 0, bottom: 72, alignItems: 'center', paddingHorizontal: space.lg, gap: 4 },
  count: { letterSpacing: 2.5, marginBottom: space.sm },
  of: { fontFamily: fonts.displayLight, fontSize: 18, lineHeight: 24, fontStyle: 'italic' },
  names: { fontFamily: fonts.display, fontSize: 44, lineHeight: 54 },
  date: { fontFamily: fonts.bodyMedium, fontSize: 13, letterSpacing: 3, marginTop: 4 },
  hebDate: { fontFamily: fonts.body, fontSize: 13, letterSpacing: 0.5 },
  body: { paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.xl, marginTop: -44, maxWidth: 720, width: '100%', alignSelf: 'center' },
  tilesCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tilesRow: { flexDirection: 'row' },
  vRule: { width: 1, backgroundColor: colors.line },
  hRule: { height: 1, backgroundColor: colors.line },
  tile: { flex: 1, padding: space.md, gap: 10 },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, minHeight: 34 },
  tileValue: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.ink, flexShrink: 0 },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.offWhite,
    padding: space.md,
  },
  insightIcon: { width: 28, height: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  cat: {
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
