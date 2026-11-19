import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Small gold label above the title. */
  eyebrow?: string;
  children: ReactNode;
  /** Sticky actions under the scrollable content (e.g. Save / Cancel). */
  footer?: ReactNode;
};

/** Bottom sheet on phones (also phone-width web), centered dialog on wide screens. */
export function Sheet({ visible, onClose, title, eyebrow, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dialog = width >= 720;
  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, { justifyContent: dialog ? 'center' : 'flex-end' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="סגירה" />
        <View
          style={[
            styles.panel,
            dialog ? styles.dialog : null,
            { paddingBottom: Math.max(insets.bottom, space.md) },
          ]}>
          {!dialog ? <View style={styles.handle} /> : null}
          <View style={styles.head}>
            <View style={{ flex: 1, gap: 2 }}>
              {eyebrow ? (
                <Text variant="eyebrow" color={colors.gold}>
                  {eyebrow}
                </Text>
              ) : null}
              {title ? <Text variant="h2">{title}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="סגירה" style={styles.close}>
              <Feather name="x" size={18} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', alignItems: 'center' },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lg,
  },
  dialog: { borderRadius: radius.xl },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 0, backgroundColor: colors.stoneDeep, marginTop: 10 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  close: {
    width: 34,
    height: 34,
    borderRadius: 0,
    backgroundColor: colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: space.lg, paddingTop: space.sm, gap: space.md },
  footer: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
});
