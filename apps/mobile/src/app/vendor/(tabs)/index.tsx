import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { VendorStatusCard } from '@/components/VendorStatusCard';
import { Card, SectionTitle } from '@/components/ui';
import { greeting } from '@/lib/dates';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

/** Vendor dashboard (spec §9). Metrics are placeholders until leads/calendar exist. */
export default function VendorDashboard() {
  const { vendor, reload, loading } = useOwnVendor();

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={{ gap: 4, marginTop: space.md }}>
        <Text variant="caption" color={colors.inkMuted} style={{ letterSpacing: 3 }}>
          BUSINESS
        </Text>
        <Text variant="h1">{`${greeting()}, ${vendor.businessName}`}</Text>
      </View>

      <VendorStatusCard vendor={vendor} />

      <SectionTitle>תמונת מצב</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {['פניות חדשות', 'אירועים קרובים', 'צפיות בפרופיל', 'שמירות'].map((label) => (
          <Card key={label} style={{ flexGrow: 1, flexBasis: 140, gap: space.xs }}>
            <Text variant="h1">—</Text>
            <Text variant="caption" color={colors.inkSoft}>
              {label}
            </Text>
          </Card>
        ))}
      </View>
      <Text variant="caption" color={colors.inkMuted}>
        הנתונים יופיעו כאן כשזוגות יתחילו לפנות אליכם.
      </Text>
    </Screen>
  );
}
