import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, shadow } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';

/** Two or three mutually exclusive tabs inside one pill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <PressableScale
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            scaleTo={0.97}
            onPress={() => onChange(o.key)}
            style={[styles.item, on && styles.itemOn]}>
            <Text variant="label" align="center" color={on ? colors.inverse : colors.inkSoft} style={{ fontFamily: fonts.bodyMedium }}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.offWhite },
  item: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
  itemOn: { backgroundColor: colors.accent, ...shadow.accent },
});
