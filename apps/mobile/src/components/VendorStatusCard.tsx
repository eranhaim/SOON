import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getVendorReadiness, isVendorReady, type VendorOwnerDTO } from '@soon/shared';

import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { useVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';
import { Card, ReadinessList, StatusBadge } from './ui';

/** Where the storefront stands in the approval flow, and the next step. */
export function VendorStatusCard({ vendor }: { vendor: VendorOwnerDTO }) {
  const { mutate } = useVendor();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const items = getVendorReadiness(vendor);
  const ready = isVendorReady(vendor);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await mutate('/api/vendors/me/submit', { method: 'POST' });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const copy: Record<VendorOwnerDTO['status'], { title: string; body: string }> = {
    draft: {
      title: 'הפרופיל שלכם עדיין טיוטה',
      body: 'השלימו את הפרטים ושלחו לאישור. אחרי האישור, זוגות יוכלו למצוא אתכם בחיפוש.',
    },
    pending: {
      title: 'הפרופיל נשלח לאישור',
      body: `אנחנו עוברים על הפרופיל ונעדכן אתכם כאן. אפשר להמשיך לערוך בינתיים.${vendor.submittedAt ? ` נשלח ב־${formatDate(vendor.submittedAt)}.` : ''}`,
    },
    approved: { title: 'הפרופיל שלכם פעיל', body: 'זוגות יכולים למצוא אתכם ולצפות בעמוד העסק.' },
    rejected: {
      title: 'הפרופיל לא אושר',
      body: 'עדכנו את הפרופיל לפי ההערה ושלחו שוב לאישור.',
    },
    suspended: {
      title: 'הפרופיל הושעה',
      body: 'הפרופיל אינו מוצג לזוגות כרגע. לפרטים צרו קשר עם צוות SOON.',
    },
  };
  const c = copy[vendor.status];
  const canSubmit = vendor.status === 'draft' || vendor.status === 'rejected';

  return (
    <Card tone={vendor.status === 'approved' ? 'plain' : 'muted'}>
      <StatusBadge status={vendor.status} />
      <View style={{ gap: space.xs }}>
        <Text variant="h2">{c.title}</Text>
        <Text variant="bodySmall" color={colors.inkSoft}>
          {c.body}
        </Text>
      </View>
      {vendor.statusReason && (vendor.status === 'rejected' || vendor.status === 'suspended') ? (
        <View style={{ borderStartWidth: 2, borderStartColor: colors.danger, paddingStart: space.md, gap: 2 }}>
          <Text variant="caption" color={colors.inkMuted}>
            הערת הצוות
          </Text>
          <Text variant="bodySmall">{vendor.statusReason}</Text>
        </View>
      ) : null}
      {canSubmit ? (
        <>
          <ReadinessList items={items} />
          {error ? (
            <Text variant="bodySmall" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          {ready ? (
            <Button label="שליחה לאישור" loading={busy} onPress={submit} />
          ) : (
            <Button variant="outline" label="השלמת הפרופיל" onPress={() => router.push('/vendor/business')} />
          )}
        </>
      ) : null}
      {vendor.status === 'approved' ? (
        <Button
          variant="outline"
          label="צפייה בעמוד העסק"
          onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug } })}
        />
      ) : null}
    </Card>
  );
}
