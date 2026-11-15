import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, addMonths, monthInfo, todayIso } from '@soon/shared';

import { formatMonth } from '@/lib/dates';
import { colors, space } from '@/theme/tokens';

import { Text } from './Text';

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

export type DayMark = { color: string; filled?: boolean };

type Props = {
  /** Any date in the month to show (YYYY-MM-DD). */
  month: string;
  onMonthChange: (month: string) => void;
  selected?: string | null;
  onSelect?: (date: string) => void;
  /** Up to 3 dots per day (calendar statuses, events…). */
  marks?: Record<string, DayMark[]>;
  minDate?: string;
};

/** Sunday-first month grid. Rows run right-to-left under RTL on native and web alike. */
export function MonthCalendar({ month, onMonthChange, selected, onSelect, marks, minDate }: Props) {
  const info = monthInfo(month);
  const today = todayIso();
  const cells: (string | null)[] = [
    ...Array.from({ length: info.weekday }, () => null),
    ...Array.from({ length: info.days }, (_, i) => addDays(info.first, i)),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        {/* RTL: "previous" sits on the right and points right. */}
        <Pressable accessibilityRole="button" accessibilityLabel="החודש הקודם" hitSlop={10} onPress={() => onMonthChange(addMonths(info.first, -1))}>
          <Feather name="chevron-right" size={22} color={colors.ink} />
        </Pressable>
        <Text variant="h2" align="center" style={{ flex: 1 }}>
          {formatMonth(info.first)}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="החודש הבא" hitSlop={10} onPress={() => onMonthChange(addMonths(info.first, 1))}>
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={styles.cell}>
            <Text variant="caption" color={colors.inkMuted} align="center">
              {d}
            </Text>
          </View>
        ))}
      </View>

      {weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const isSelected = day === selected;
            const disabled = Boolean(minDate && day < minDate);
            const dayMarks = marks?.[day] ?? [];
            return (
              <Pressable
                key={day}
                disabled={disabled || !onSelect}
                onPress={() => onSelect?.(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={day}
                style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}>
                <View style={[styles.day, isSelected && styles.daySelected, day === today && !isSelected && styles.dayToday]}>
                  <Text
                    variant="bodySmall"
                    align="center"
                    color={isSelected ? colors.inverse : disabled ? colors.stoneDeep : colors.ink}>
                    {Number(day.slice(8))}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {dayMarks.slice(0, 3).map((m, k) => (
                    <View
                      key={k}
                      style={[styles.dot, { borderColor: m.color, backgroundColor: m.filled === false ? 'transparent' : m.color }]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, minHeight: 44 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.ink },
  dayToday: { borderWidth: 1, borderColor: colors.ink },
  dots: { flexDirection: 'row', gap: 2, height: 6, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3, borderWidth: 1 },
});
