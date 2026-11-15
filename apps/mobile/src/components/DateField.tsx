import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { todayIso } from '@soon/shared';

import { formatDay } from '@/lib/dates';
import { colors, hairline, space } from '@/theme/tokens';

import { Button } from './Button';
import { MonthCalendar } from './MonthCalendar';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Props = {
  label: string;
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
  minDate?: string;
  /** Show a "clear" action (the field is optional). */
  clearable?: boolean;
};

/** A civil date picker that looks like our TextField and opens a calendar sheet. */
export function DateField({ label, value, onChange, placeholder = 'בחירת תאריך', minDate, clearable }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value ?? minDate ?? todayIso());

  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" color={colors.inkSoft}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatDay(value) : placeholder}`}
        onPress={() => {
          setMonth(value ?? minDate ?? todayIso());
          setOpen(true);
        }}
        style={styles.field}>
        <Text variant="body" color={value ? colors.ink : colors.inkMuted} style={{ flex: 1, fontSize: 17 }}>
          {value ? formatDay(value) : placeholder}
        </Text>
        <Feather name="calendar" size={18} color={colors.inkSoft} />
      </Pressable>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          clearable && value ? (
            <Button
              variant="ghost"
              label="ניקוי תאריך"
              style={{ flex: 1 }}
              onPress={() => {
                onChange(null);
                setOpen(false);
              }}
            />
          ) : undefined
        }>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          selected={value}
          minDate={minDate}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: hairline,
    borderBottomColor: colors.stoneDeep,
  },
});
