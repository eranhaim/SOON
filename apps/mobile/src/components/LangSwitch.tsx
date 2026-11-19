import { Pressable, StyleSheet, View } from 'react-native';

import { notify } from '@/lib/confirm';
import { ENGLISH_READY, useLang, type Lang } from '@/lib/lang';
import { colors, fonts } from '@/theme/tokens';

import { Text } from './Text';

/** "עב | EN" switch. `tone="light"` for dark backgrounds. */
export function LangSwitch({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { lang, setLang } = useLang();
  const fg = tone === 'light' ? colors.inverse : colors.ink;
  const choose = (l: Lang) => {
    if (l === 'en' && !ENGLISH_READY) {
      notify('English', 'The English version is coming soon.');
      return;
    }
    setLang(l);
  };
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="שפה">
      {(['he', 'en'] as const).map((l) => {
        const on = lang === l;
        return (
          <Pressable
            key={l}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            hitSlop={8}
            onPress={() => choose(l)}
            style={[styles.item, on && { borderBottomColor: fg }]}>
            <Text color={fg} style={[styles.label, !on && { opacity: 0.5 }]}>
              {l === 'he' ? 'עב' : 'EN'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14 },
  item: { paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 1 },
});
