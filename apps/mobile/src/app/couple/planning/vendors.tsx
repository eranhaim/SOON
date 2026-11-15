import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CLOSED_LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@soon/shared';

import { Button } from '@/components/Button';
import { PressableScale, Reveal } from '@/components/motion';
import { ProgressBar } from '@/components/Progress';
import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import type { IconName } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { useOwnWedding } from '@/lib/wedding';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

type MyVendor = { id: string; slug: string; businessName: string; categorySlug: string; leadStatus: LeadStatus | null };

const ICONS: Record<string, IconName> = {
  venue: 'home',
  photography: 'camera',
  video: 'video',
  dj: 'music',
  makeup: 'feather',
  hair: 'scissors',
  dresses: 'star',
  suits: 'briefcase',
  flowers: 'sun',
  social: 'instagram',
  production: 'clipboard',
  catering: 'coffee',
};

/** The couple's vendors per category: closed (with the vendor), in talks, or still searching. */
export default function MyVendors() {
  const wedding = useOwnWedding();
  const q = useApiQuery<MyVendor[]>(keys.myVendors, '/api/planning/my-vendors');
  if (q.isPending) return <Loading />;
  const list = q.data ?? [];
  const cats = wedding.categories;
  const closedCount = cats.filter((c) => c.status === 'closed').length;

  return (
    <Screen title="הספקים שלי" back backTo="/couple/planning">
      <Reveal style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.big}>{closedCount}</Text>
          <Text style={styles.of}>{`/ ${cats.length}`}</Text>
          <Text variant="bodySmall" color={colors.inkSoft} style={{ marginStart: 'auto' } as object}>
            קטגוריות נסגרו
          </Text>
        </View>
        <ProgressBar value={cats.length ? closedCount / cats.length : 0} height={5} />
      </Reveal>

      <View style={{ gap: space.sm }}>
        {cats.map((c, i) => {
          const booked = list.find((v) => v.categorySlug === c.slug && v.leadStatus && CLOSED_LEAD_STATUSES.includes(v.leadStatus));
          const talking = list.find((v) => v.categorySlug === c.slug && v.leadStatus && !CLOSED_LEAD_STATUSES.includes(v.leadStatus));
          const closed = c.status === 'closed' || !!booked;
          const vendor = booked ?? talking;
          const hint = booked
            ? booked.businessName
            : c.status === 'closed'
              ? 'נסגר מחוץ ל־SOON'
              : talking
                ? `${talking.businessName} · ${LEAD_STATUS_LABELS[talking.leadStatus!]}`
                : 'עדיין לא נסגר';
          return (
            <Reveal key={c.slug} index={i}>
              <PressableScale
                scaleTo={0.98}
                onPress={() =>
                  vendor
                    ? router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })
                    : router.push({ pathname: '/couple/explore', params: { category: c.slug } })
                }
                style={styles.row}>
                <View style={[styles.icon, closed && styles.iconDone]}>
                  <Feather name={closed ? 'check' : (ICONS[c.slug] ?? 'circle')} size={18} color={closed ? colors.inverse : colors.gold} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h3">{c.label}</Text>
                  <Text variant="caption" color={closed ? colors.success : colors.inkMuted} numberOfLines={1}>
                    {hint}
                  </Text>
                </View>
                {closed || vendor ? (
                  <Feather name="chevron-left" size={18} color={colors.stoneDeep} />
                ) : (
                  <Button
                    label="חיפוש"
                    size="sm"
                    variant="soft"
                    onPress={() => router.push({ pathname: '/couple/explore', params: { category: c.slug } })}
                  />
                )}
              </PressableScale>
            </Reveal>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  big: { fontFamily: fonts.display, fontSize: 48, lineHeight: 56, color: colors.accent },
  of: { fontFamily: fonts.display, fontSize: 22, color: colors.inkMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  iconDone: { backgroundColor: colors.success },
});
