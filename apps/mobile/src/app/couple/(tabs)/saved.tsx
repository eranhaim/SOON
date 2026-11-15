import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import type { SavedVendorDTO } from '@soon/shared';

import { Button } from '@/components/Button';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VendorCard } from '@/components/VendorCard';
import { Chip, ChipGroup } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { colors, space } from '@/theme/tokens';

/** Saved vendors (spec §6), grouped by category, with "compare" for 2–3 of the same kind. */
export default function Saved() {
  const q = useApiQuery<SavedVendorDTO[]>(keys.saved, '/api/saved');
  const [category, setCategory] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 3 : width >= 600 ? 2 : 1;

  if (q.isPending) return <Loading />;
  const all = q.data ?? [];
  const cats = [...new Map(all.map((v) => [v.categorySlug, v.categoryLabel])).entries()];
  const shown = category ? all.filter((v) => v.categorySlug === category) : all;
  const compareable = category && shown.length >= 2;

  return (
    <Screen title="שמורים" subtitle="רשימה משותפת לשניכם" maxWidth={1100} refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      {all.length === 0 ? (
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
          <Feather name="heart" size={28} color={colors.inkMuted} />
          <Text variant="h2" align="center">
            עוד לא שמרתם ספקים
          </Text>
          <Text variant="bodySmall" color={colors.inkSoft} align="center">
            לחצו על הלב בכל ספק שאהבתם כדי לחזור אליו ולהשוות.
          </Text>
          <Button label="לגילוי ספקים" onPress={() => router.push('/couple/explore')} style={{ marginTop: space.md }} />
        </View>
      ) : (
        <>
          <ChipGroup>
            <Chip label="הכל" count={all.length} selected={!category} onPress={() => setCategory(null)} />
            {cats.map(([slug, label]) => (
              <Chip key={slug} label={label} count={all.filter((v) => v.categorySlug === slug).length} selected={category === slug} onPress={() => setCategory(slug)} />
            ))}
          </ChipGroup>
          {compareable ? (
            <Button
              variant="outline"
              label={`השוואת ${Math.min(shown.length, 3)} ספקים`}
              onPress={() => router.push({ pathname: '/couple/compare', params: { ids: shown.slice(0, 3).map((v) => v.id).join(',') } })}
            />
          ) : category == null && cats.some(([slug]) => all.filter((v) => v.categorySlug === slug).length >= 2) ? (
            <Text variant="caption" color={colors.inkMuted}>
              בחרו קטגוריה כדי להשוות בין ספקים.
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
            {shown.map((v) => (
              <View key={v.id} style={{ width: cols === 1 ? '100%' : `${100 / cols - 3}%` }}>
                <VendorCard vendor={v} footnote={v.note} />
              </View>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
