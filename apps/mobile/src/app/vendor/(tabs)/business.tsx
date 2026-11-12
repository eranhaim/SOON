import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { ListRow, SectionTitle, StatusBadge } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { useOwnVendor } from '@/lib/vendor-context';
import { colors, space } from '@/theme/tokens';

/** Business hub (spec §2: Profile, Portfolio, Packages, Analytics, Documents, Payments, Settings). */
export default function Business() {
  const { vendor } = useOwnVendor();

  return (
    <Screen title="העסק">
      <View style={styles.head}>
        <View style={styles.thumb}>
          {vendor.coverUrl ? <Image source={vendor.coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h2">{vendor.businessName}</Text>
          <Text variant="caption" color={colors.inkSoft}>
            {vendor.categoryLabel}
          </Text>
          <StatusBadge status={vendor.status} />
        </View>
      </View>

      <View>
        <SectionTitle>הפרופיל</SectionTitle>
        <ListRow icon="edit-3" label="פרטי העסק" hint="שם, תחום, אזורים, מחירים, אודות" onPress={() => router.push('/vendor/profile')} />
        <ListRow
          icon="image"
          label="תיק עבודות"
          hint={`קאבר, לוגו ו־${vendor.media.length} תמונות`}
          onPress={() => router.push('/vendor/portfolio')}
        />
        <ListRow
          icon="package"
          label="חבילות ומחירים"
          hint={vendor.packages.length ? `${vendor.packages.length} חבילות` : 'עדיין אין חבילות'}
          onPress={() => router.push('/vendor/packages')}
        />
        <ListRow
          icon="help-circle"
          label="שאלות נפוצות"
          hint={vendor.faqs.length ? `${vendor.faqs.length} שאלות` : 'עדיין אין שאלות'}
          onPress={() => router.push('/vendor/faq')}
        />
        <ListRow
          icon="eye"
          label="תצוגה מקדימה"
          hint="כך זוגות רואים את העמוד שלכם"
          onPress={() => router.push({ pathname: '/v/[slug]', params: { slug: vendor.slug, preview: '1' } })}
        />
      </View>

      <View>
        <SectionTitle>ניהול</SectionTitle>
        <ListRow icon="bar-chart-2" label="סטטיסטיקות" hint="בקרוב" disabled />
        <ListRow icon="file-text" label="מסמכים והסכמים" hint="בקרוב" disabled />
        <ListRow icon="credit-card" label="תשלומים" hint="בקרוב" disabled />
        <ListRow icon="settings" label="הגדרות" hint="בקרוב" disabled />
        <ListRow
          icon="log-out"
          label="התנתקות"
          trailing={<View />}
          onPress={async () => {
            await authClient.signOut();
            router.replace('/choose-role');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 88, height: 88, backgroundColor: colors.stone, overflow: 'hidden' },
});
