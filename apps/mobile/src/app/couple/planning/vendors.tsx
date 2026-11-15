import { router } from 'expo-router';
import { View } from 'react-native';

import { categoryLabel, CLOSED_LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@soon/shared';

import { Loading, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ListRow, SectionTitle } from '@/components/ui';
import { keys, useApiQuery } from '@/lib/query';
import { useOwnWedding } from '@/lib/wedding';
import { colors } from '@/theme/tokens';

type MyVendor = { id: string; slug: string; businessName: string; categorySlug: string; leadStatus: LeadStatus | null };

/** The couple's vendors: booked, in talks, saved, and categories still missing. */
export default function MyVendors() {
  const wedding = useOwnWedding();
  const q = useApiQuery<MyVendor[]>(keys.myVendors, '/api/planning/my-vendors');
  if (q.isPending) return <Loading />;
  const list = q.data ?? [];
  const booked = list.filter((v) => v.leadStatus && CLOSED_LEAD_STATUSES.includes(v.leadStatus));
  const talking = list.filter((v) => v.leadStatus && !CLOSED_LEAD_STATUSES.includes(v.leadStatus));
  const needed = wedding.categories.filter((c) => c.status === 'needed');

  const row = (v: MyVendor) => (
    <ListRow
      key={v.id}
      label={v.businessName}
      hint={[categoryLabel(v.categorySlug), v.leadStatus ? LEAD_STATUS_LABELS[v.leadStatus] : 'שמור'].join(' · ')}
      onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: v.slug } })}
    />
  );

  return (
    <Screen title="הספקים שלנו" back backTo="/couple/planning">
      <View>
        <SectionTitle>סגורים</SectionTitle>
        {booked.length ? booked.map(row) : <Text color={colors.inkSoft}>עוד לא סגרתם ספקים דרך SOON.</Text>}
      </View>
      <View>
        <SectionTitle>בתהליך</SectionTitle>
        {talking.length ? talking.map(row) : <Text color={colors.inkSoft}>אין שיחות פתוחות.</Text>}
      </View>
      <View>
        <SectionTitle>עוד מחפשים</SectionTitle>
        {needed.map((c) => (
          <ListRow key={c.slug} icon="search" label={c.label} hint="מצאו ספקים" onPress={() => router.push({ pathname: '/couple/explore', params: { category: c.slug } })} />
        ))}
        {!needed.length ? <Text color={colors.inkSoft}>סימנתם שכל הקטגוריות סגורות.</Text> : null}
      </View>
    </Screen>
  );
}
