import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatAgorot, VENDOR_CATEGORIES, type CoupleHomeDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VendorCard } from '@/components/VendorCard';
import { SectionTitle, type IconName } from '@/components/ui';
import { formatDateTime, formatDay } from '@/lib/dates';
import { keys, useApiQuery } from '@/lib/query';
import { colors, hairline, radius, space } from '@/theme/tokens';

/** Couple home (spec §4): countdown, quick cards, big search, nudges, personal feed. */
export default function CoupleHome() {
  const q = useApiQuery<CoupleHomeDTO>(keys.home, '/api/couple/home');
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

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()} contentStyle={{ gap: space.xl }}>
      {/* Countdown hero */}
      <View style={styles.hero}>
        <Text variant="caption" color={colors.stoneDeep} align="center" style={{ letterSpacing: 4 }}>
          SOON
        </Text>
        {h.daysToGo != null && h.daysToGo >= 0 ? (
          <>
            <Text align="center" color={colors.inverse} style={styles.count}>
              {h.daysToGo}
            </Text>
            <Text variant="label" align="center" color={colors.stone} style={{ letterSpacing: 3 }}>
              {h.daysToGo === 1 ? 'יום לחתונה' : 'ימים לחתונה'}
            </Text>
          </>
        ) : null}
        <Text variant="h1" align="center" color={colors.inverse} style={{ marginTop: space.md }}>
          {`${w.partner1Name} & ${w.partner2Name}`}
        </Text>
        <Text variant="bodySmall" align="center" color={colors.stone}>
          {[w.weddingDate ? formatDay(w.weddingDate) : 'התאריך עוד לא נקבע', w.venueName].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {/* Quick cards (spec §4: Budget, Vendors, Tasks, Next Event) */}
      <View style={styles.tiles}>
        <Tile
          icon="credit-card"
          label="תקציב"
          value={h.budget.totalAgorot ? formatAgorot(h.budget.totalAgorot - h.budget.committedAgorot) : '—'}
          hint={h.budget.totalAgorot ? 'נותר לחלוקה' : 'הגדירו תקציב'}
          href="/couple/planning/budget"
        />
        <Tile
          icon="users"
          label="ספקים"
          value={`${h.vendors.closed}/${h.vendors.closed + h.vendors.needed}`}
          hint="קטגוריות סגורות"
          href="/couple/planning/vendors"
        />
        <Tile
          icon="check-square"
          label="משימות"
          value={String(h.tasks.open)}
          hint={h.tasks.next ? h.tasks.next.title : 'הכל בוצע'}
          href="/couple/planning/checklist"
        />
        <Tile
          icon="calendar"
          label="האירוע הבא"
          value={h.nextEvent ? formatDateTime(h.nextEvent.startsAt) : '—'}
          hint={h.nextEvent?.title ?? 'אין אירועים קרובים'}
          href="/couple/planning/calendar"
        />
      </View>

      {/* Big search */}
      <Pressable accessibilityRole="search" onPress={() => router.push('/couple/explore')} style={styles.search}>
        <Feather name="search" size={20} color={colors.inkSoft} />
        <Text variant="body" color={colors.inkMuted}>
          מה אתם מחפשים?
        </Text>
      </Pressable>

      {h.insights.length ? (
        <View style={{ gap: space.sm }}>
          {h.insights.map((i) => (
            <Pressable
              key={i.key}
              disabled={!i.href}
              onPress={() => i.href && router.push(i.href as Href)}
              style={({ pressed }) => [styles.insight, pressed && { opacity: 0.7 }]}>
              <View style={styles.insightDot} />
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {i.text}
              </Text>
              {i.href ? <Feather name="chevron-left" size={16} color={colors.inkMuted} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Visual categories */}
      <View style={{ gap: space.md }}>
        <SectionTitle>קטגוריות</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {VENDOR_CATEGORIES.filter((c) => !closedSet.has(c.slug)).map((c) => (
            <Pressable
              key={c.slug}
              onPress={() => router.push({ pathname: '/couple/explore', params: { category: c.slug } })}
              style={({ pressed }) => [styles.cat, pressed && { backgroundColor: colors.stone }]}>
              <Text variant="bodySmall">{c.he}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {h.recommended.length ? (
        <Carousel title="מומלצים בשבילכם" items={h.recommended} />
      ) : null}
      {h.fresh.length ? <Carousel title="חדשים ב־SOON" items={h.fresh} /> : null}
    </Screen>
  );
}

function Tile({ icon, label, value, hint, href }: { icon: IconName; label: string; value: string; hint: string; href: Href }) {
  return (
    <Pressable onPress={() => router.push(href)} style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.ink }]}>
      <View style={styles.tileHead}>
        <Feather name={icon} size={16} color={colors.inkSoft} />
        <Text variant="caption" color={colors.inkSoft}>
          {label}
        </Text>
      </View>
      <Text variant="h2" numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color={colors.inkMuted} numberOfLines={1}>
        {hint}
      </Text>
    </Pressable>
  );
}

function Carousel({ title, items }: { title: string; items: CoupleHomeDTO['recommended'] }) {
  return (
    <View style={{ gap: space.md }}>
      <SectionTitle>{title}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        {items.map((v) => (
          <VendorCard key={v.id} vendor={v} variant="compact" />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.night, paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: 2, marginTop: space.sm },
  count: { fontFamily: 'FrankRuhlLibre_400Regular', fontSize: 72, lineHeight: 84 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '45%', borderWidth: hairline, borderColor: colors.line, padding: space.md, gap: 4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 56,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
    borderRadius: radius.pill,
  },
  insight: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.offWhite, padding: space.md },
  insightDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ink },
  cat: { paddingHorizontal: space.md, paddingVertical: space.md, backgroundColor: colors.offWhite, borderRadius: radius.sm },
});
