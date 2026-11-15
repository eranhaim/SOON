import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hairline, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky actions under the scrollable content (e.g. Save / Cancel). */
  footer?: ReactNode;
};

/** Bottom sheet on phones, centered dialog on wide screens. Used for forms and pickers. */
export function Sheet({ visible, onClose, title, children, footer }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'web' ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="סגירה" />
        <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.head}>
            <Text variant="h2" style={{ flex: 1 }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="סגירה">
              <Feather name="x" size={22} color={colors.ink} />
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14,14,14,0.45)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    ...(Platform.OS === 'web' ? { borderRadius: 8 } : null),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: hairline,
    borderBottomColor: colors.line,
  },
  body: { padding: space.lg, gap: space.md },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: hairline,
    borderTopColor: colors.line,
  },
});
