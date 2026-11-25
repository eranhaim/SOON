import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts } from '@/theme/tokens';

import { Text } from './Text';

/** Red bubble with a count (new messages). Renders nothing for 0. */
export function CountBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  if (count <= 0) return null;
  return (
    <View style={[styles.badge, style]} accessibilityLabel={`${count} הודעות חדשות`}>
      <Text style={styles.text}>{count > 99 ? '99+' : String(count)}</Text>
    </View>
  );
}

export const BADGE_RED = '#E0262B';

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: BADGE_RED,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  text: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 13 },
});
