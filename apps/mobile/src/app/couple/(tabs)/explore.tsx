import Feather from '@expo/vector-icons/Feather';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  REGIONS,
  shekelsToAgorot,
  VENDOR_CATEGORIES,
  type RegionSlug,
  type VendorSearch,
  type VendorSearchResult,
} from '@soon/shared';

import { Button } from '@/components/Button';
import { DateField } from '@/components/DateField';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { TextField } from '@/components/TextField';
import { VendorCard } from '@/components/VendorCard';
import { Chip, ChipGroup } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDay } from '@/lib/dates';
import { keys } from '@/lib/query';
import { useWedding } from '@/lib/wedding';
import { colors, fonts, hairline, radius, space, textStart } from '@/theme/tokens';

type Filters = {
  q: string;
  category?: string;
  region?: RegionSlug;
  date?: string | null;
  priceMin: string;
  priceMax: string;
  onlyAvailable: boolean;
  sort: VendorSearch['sort'];
};

const SORTS: { key: VendorSearch['sort']; label: string }[] = [
  { key: 'relevance', label: 'רלוונטיות' },
  { key: 'popular', label: 'פופולריות' },
  { key: 'rating', label: 'דירוג' },
  { key: 'price_asc', label: 'מחיר עולה' },
  { key: 'price_desc', label: 'מחיר יורד' },
];

function toQuery(f: Filters) {
  const p: Record<string, string> = { sort: f.sort, limit: '20' };
  if (f.q.trim()) p.q = f.q.trim();
  if (f.category) p.category = f.category;
  if (f.region) p.region = f.region;
  if (f.date) p.date = f.date;
  const min = shekelsToAgorot(f.priceMin);
  const max = shekelsToAgorot(f.priceMax);
  if (min != null) p.priceMin = String(min);
  if (max != null) p.priceMax = String(max);
  if (f.onlyAvailable) p.onlyAvailable = 'true';
  return p;
}

/** Vendor search (spec §5): category, region, date, price, availability, sort. */
export default function Explore() {
  const params = useLocalSearchParams<{ category?: string }>();
  const wedding = useWedding().data?.wedding;
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 640 ? 2 : 1;

  const [filters, setFilters] = useState<Filters>({
    q: '',
    category: params.category,
    region: wedding?.region ?? undefined,
    date: wedding?.weddingDate ?? null,
    priceMin: '',
    priceMax: '',
    onlyAvailable: false,
    sort: 'relevance',
  });
  const [draft, setDraft] = useState(filters);
  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState('');

  // A category link from home (or a nudge) replaces the current category.
  useEffect(() => {
    if (params.category) setFilters((f) => ({ ...f, category: params.category }));
  }, [params.category]);

  // Debounced free-text search.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === text ? f : { ...f, q: text })), 350);
    return () => clearTimeout(t);
  }, [text]);

  const query = useMemo(() => toQuery(filters), [filters]);
  const q = useInfiniteQuery({
    queryKey: keys.search(query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<VendorSearchResult>(`/api/search/vendors?${new URLSearchParams({ ...query, ...(pageParam ? { cursor: pageParam } : {}) })}`),
    getNextPageParam: (last) => last.nextCursor,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total;

  const activeCount = [filters.region, filters.date, filters.priceMin, filters.priceMax, filters.onlyAvailable || undefined].filter(Boolean).length;

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Text variant="h1">גילוי ספקים</Text>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Feather name="search" size={18} color={colors.inkSoft} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="מה אתם מחפשים?"
            placeholderTextColor={colors.inkMuted}
            style={[styles.searchInput, { textAlign: textStart }]}
            returnKeyType="search"
            accessibilityLabel="חיפוש"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="סינון"
          onPress={() => {
            setDraft(filters);
            setSheet(true);
          }}
          style={[styles.filterBtn, activeCount > 0 && styles.filterBtnOn]}>
          <Feather name="sliders" size={18} color={activeCount ? colors.inverse : colors.ink} />
          {activeCount ? (
            <Text variant="caption" color={colors.inverse}>
              {activeCount}
            </Text>
          ) : null}
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={[{ slug: undefined, he: 'הכל' }, ...VENDOR_CATEGORIES]}
        keyExtractor={(c) => c.slug ?? 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
        renderItem={({ item }) => (
          <Chip label={item.he} selected={filters.category === item.slug} onPress={() => setFilters((f) => ({ ...f, category: item.slug }))} />
        )}
      />
      <View style={styles.metaRow}>
        <Text variant="caption" color={colors.inkSoft} style={{ flex: 1 }}>
          {total != null ? `${total} ספקים${filters.date ? ` · זמינות ל־${formatDay(filters.date)}` : ''}` : ' '}
        </Text>
        <Pressable
          onPress={() => {
            const i = SORTS.findIndex((s) => s.key === filters.sort);
            setFilters((f) => ({ ...f, sort: SORTS[(i + 1) % SORTS.length]!.key }));
          }}
          accessibilityRole="button"
          style={styles.sort}>
          <Feather name="bar-chart" size={14} color={colors.ink} />
          <Text variant="caption">{SORTS.find((s) => s.key === filters.sort)!.label}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns > 1 ? { gap: space.lg } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: space.xl }} />}
        renderItem={({ item }) => (
          <View style={{ flex: 1 / columns }}>
            <VendorCard vendor={item} />
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        ListEmptyComponent={
          q.isPending ? (
            <ActivityIndicator color={colors.ink} style={{ marginTop: space.xl }} />
          ) : (
            <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
              <Feather name="search" size={26} color={colors.inkMuted} />
              <Text variant="h2" align="center">
                לא מצאנו ספקים
              </Text>
              <Text variant="bodySmall" color={colors.inkSoft} align="center">
                נסו להרחיב את הסינון או לחפש במילים אחרות.
              </Text>
            </View>
          )
        }
        ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={colors.ink} style={{ margin: space.lg }} /> : undefined}
      />

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="סינון"
        footer={
          <>
            <Button
              variant="ghost"
              label="ניקוי"
              style={{ flex: 1 }}
              onPress={() => setDraft({ ...draft, region: undefined, date: null, priceMin: '', priceMax: '', onlyAvailable: false })}
            />
            <Button
              label="הצגת תוצאות"
              style={{ flex: 2 }}
              onPress={() => {
                setFilters({ ...draft, q: filters.q, category: filters.category });
                setSheet(false);
              }}
            />
          </>
        }>
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color={colors.inkSoft}>
            אזור
          </Text>
          <ChipGroup>
            {REGIONS.map((r) => (
              <Chip key={r.slug} label={r.he} selected={draft.region === r.slug} onPress={() => setDraft({ ...draft, region: draft.region === r.slug ? undefined : r.slug })} />
            ))}
          </ChipGroup>
        </View>
        <DateField label="תאריך האירוע" value={draft.date ?? null} onChange={(d) => setDraft({ ...draft, date: d })} clearable />
        <Chip
          label="רק ספקים פנויים בתאריך"
          selected={draft.onlyAvailable}
          onPress={() => setDraft({ ...draft, onlyAvailable: !draft.onlyAvailable })}
        />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <TextField label="מחיר מינימום (₪)" ltr keyboardType="number-pad" value={draft.priceMin} onChangeText={(v) => setDraft({ ...draft, priceMin: v })} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="מחיר מקסימום (₪)" ltr keyboardType="number-pad" value={draft.priceMax} onChangeText={(v) => setDraft({ ...draft, priceMax: v })} />
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <Text variant="caption" color={colors.inkSoft}>
            מיון
          </Text>
          <ChipGroup>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={draft.sort === s.key} onPress={() => setDraft({ ...draft, sort: s.key })} />
            ))}
          </ChipGroup>
        </View>
        <Text variant="caption" color={colors.inkMuted}>
          הזמינות מבוססת על היומן שהספק מעדכן.
        </Text>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: space.lg, paddingBottom: space.xxxl, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  searchRow: { flexDirection: 'row', gap: space.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    height: 50,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
    borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink, height: '100%' },
  filterBtn: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
    height: 50,
    paddingHorizontal: space.sm,
    borderRadius: 25,
    borderWidth: hairline,
    borderColor: colors.stoneDeep,
  },
  filterBtnOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  sort: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: space.xs },
});
