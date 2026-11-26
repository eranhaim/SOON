import { View } from 'react-native';

import { colors, space } from '@/theme/tokens';

import { Screen } from './Screen';
import { Text } from './Text';

export type LegalSection = { title: string; body: string[] };

/** Public text page (privacy policy, terms). Readable without an account. */
export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: LegalSection[] }) {
  return (
    <Screen back backTo="/" title={title} subtitle={`עודכן: ${updated}`} maxWidth={720}>
      {sections.map((s) => (
        <View key={s.title} style={{ gap: space.sm }}>
          <Text variant="h3">{s.title}</Text>
          {s.body.map((p) => (
            <Text key={p} variant="body" color={colors.inkSoft}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

export const CONTACT_EMAIL = 'eranhaim321@gmail.com';
