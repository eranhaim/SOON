import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { VENDOR_STATUS_LABELS, VENDOR_STATUSES, type AdminVendorList, type VendorStatus } from '@soon/shared';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Chip, ChipGroup, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { formatDate } from '@/lib/dates';
import { colors, hairline, space } from '@/theme/tokens';

/** Vendor approvals queue. Pending first; other statuses one tap away. */
export default function AdminVendors() {
  const [status, setStatus] = useState<VendorStatus>('pending');
  const [data, setData] = useState<AdminVendorList | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (s: VendorStatus) => {
    setLoading(true);
    try {
      setData(await api<AdminVendorList>(`/api/admin/vendors?status=${s}`));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload when returning from a review screen.
  useFocusEffect(
    useCallback(() => {
      void load(status);
    }, [load, status]),
  );

  return (
    <Screen
      title="ניהול ספקים"
      subtitle="אישור ספקים חדשים לפני שהם מופיעים לזוגות"
      maxWidth={960}
      refreshing={loading}
      onRefresh={() => load(status)}
      right={
        <Button
          variant="ghost"
          label="התנתקות"
          onPress={async () => {
            await authClient.signOut();
            router.replace('/choose-role');
          }}
        />
      }>
      <ChipGroup>
        {VENDOR_STATUSES.map((s) => (
          <Chip
            key={s}
            label={VENDOR_STATUS_LABELS[s]}
            count={data?.counts[s]}
            selected={status === s}
            onPress={() => setStatus(s)}
          />
        ))}
      </ChipGroup>

      {failed ? (
        <Text color={colors.danger}>לא הצלחנו לטעון את הרשימה.</Text>
      ) : data && data.items.length === 0 && !loading ? (
        <Text color={colors.inkSoft}>{status === 'pending' ? 'אין ספקים שממתינים לאישור.' : 'אין ספקים בסטטוס הזה.'}</Text>
      ) : null}

      <View>
        {data?.items.map((v) => (
          <Pressable
            key={v.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/admin/vendors/[id]', params: { id: v.id } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.offWhite }]}>
            <View style={styles.thumb}>
              {v.coverUrl ? <Image source={v.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" style={{ fontFamily: 'Heebo_500Medium' }}>
                {v.businessName}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                {`${v.categoryLabel} · ${v.ownerEmail}`}
              </Text>
              <Text variant="caption" color={colors.inkMuted}>
                {v.submittedAt ? `נשלח לאישור ${formatDate(v.submittedAt)}` : `עודכן ${formatDate(v.updatedAt)}`}
              </Text>
            </View>
            <StatusBadge status={v.status} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.line,
  },
  thumb: { width: 64, height: 64, backgroundColor: colors.stone, overflow: 'hidden' },
});
