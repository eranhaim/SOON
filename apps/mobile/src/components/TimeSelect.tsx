import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, fonts, hairline, radius, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';

/** Every half hour from 06:00 to 23:30, then 00:00 (late events end after midnight). */
export const TIME_OPTIONS = [...Array.from({ length: 36 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}), '00:00'];

/** A time field that opens a list of times (no typing). */
export function TimeSelect({ label, value, onChange, options = TIME_OPTIONS }: { label: string; value: string; onChange: (v: string) => void; options?: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => setOpen(!open)} style={[styles.field, open && styles.fieldOpen]}>
        <Text style={styles.value}>{value}</Text>
        <Feather name={open ? 'chevron-up' : 'clock'} size={16} color={colors.gold} />
      </PressableScale>
      {open ? (
        <ScrollView style={styles.list} nestedScrollEnabled contentContainerStyle={styles.grid}>
          {options.map((t) => (
            <PressableScale
              key={t}
              accessibilityRole="button"
              accessibilityState={{ selected: t === value }}
              onPress={() => {
                onChange(t);
                setOpen(false);
              }}
              style={[styles.opt, t === value && styles.optOn]}>
              <Text variant="label" color={t === value ? colors.inverse : colors.ink} style={{ fontFamily: fonts.bodyMedium }}>
                {t}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.line,
  },
  fieldOpen: { borderColor: colors.accent },
  value: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  list: { maxHeight: 210, borderRadius: radius.md, backgroundColor: colors.offWhite },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: space.sm },
  opt: { width: '23%', alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface },
  optOn: { backgroundColor: colors.accent },
});
