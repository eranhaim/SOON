import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { regionLabel, type CoupleSearchItem } from '@soon/shared';

import { useApiQuery } from '@/lib/query';
import { formatDayDots } from '@/lib/dates';
import { colors, fonts, hairline, radius, space } from '@/theme/tokens';

import { PressableScale } from './motion';
import { Text } from './Text';
import { TextField } from './TextField';

/**
 * Find a couple registered in SOON by name, email or phone (vendor side).
 * Shows names, wedding date and region only — never contact details.
 */
export function CoupleSearch({ onPick, selectedId }: { onPick: (c: CoupleSearchItem) => void; selectedId?: string | null }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const res = useApiQuery<CoupleSearchItem[]>(['couple-search', q], q.length >= 2 ? `/api/couples/search?q=${encodeURIComponent(q)}` : null);

  return (
    <View style={{ gap: space.sm }}>
      <TextField label="חיפוש זוג ב־SOON" value={text} onChangeText={setText} placeholder="שם, אימייל או טלפון" autoCapitalize="none" />
      {res.isFetching ? <ActivityIndicator color={colors.accent} /> : null}
      {q.length >= 2 && res.data && !res.data.length ? (
        <Text variant="caption" color={colors.inkMuted}>
          לא מצאנו זוג כזה. אפשר להוסיף אותו כלקוח חיצוני.
        </Text>
      ) : null}
      {res.data?.length ? (
        <View style={styles.list}>
          {res.data.map((c) => {
            const on = selectedId === c.weddingId;
            return (
              <PressableScale key={c.weddingId} accessibilityRole="button" scaleTo={0.98} onPress={() => onPick(c)} style={[styles.row, on && styles.rowOn]}>
                <View style={styles.avatar}>
                  <Text color={colors.accent} style={{ fontFamily: fonts.display, fontSize: 16 }}>
                    {c.names.charAt(0)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="body" style={{ fontFamily: fonts.bodyMedium }}>
                    {c.names}
                  </Text>
                  <Text variant="caption" color={colors.inkMuted}>
                    {[c.weddingDate ? formatDayDots(c.weddingDate) : 'ללא תאריך', c.region ? regionLabel(c.region) : null, c.leadId ? 'כבר ברשימת הלקוחות' : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Feather name={on ? 'check-circle' : 'plus-circle'} size={20} color={on ? colors.accent : colors.stoneDeep} />
              </PressableScale>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.md, overflow: 'hidden', borderWidth: hairline, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.surface, borderBottomWidth: hairline, borderBottomColor: colors.line },
  rowOn: { backgroundColor: colors.accentSoft },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
