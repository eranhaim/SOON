import { router, usePathname, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { authClient } from '@/lib/auth-client';
import { space } from '@/theme/tokens';

import { Chip } from './ui';

const ITEMS: { href: string; label: string }[] = [
  { href: '/admin', label: 'אישור ספקים' },
  { href: '/admin/users', label: 'משתמשים' },
  { href: '/admin/couples', label: 'זוגות והתקדמות' },
  { href: '/admin/templates', label: 'תבניות הזמנה' },
  { href: '/admin/settings', label: 'הגדרות' },
];

/** Sections of the admin panel, at the top of every admin screen. */
export function AdminNav() {
  const path = usePathname();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {ITEMS.map((i) => (
        <Chip key={i.href} label={i.label} selected={path === i.href} onPress={() => router.replace(i.href as Href)} />
      ))}
      <Chip
        label="התנתקות"
        onPress={async () => {
          await authClient.signOut();
          router.replace('/choose-role');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { gap: space.sm, paddingVertical: 4 } });
