import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeDialog, dismissToast, useDialogState } from '@/lib/confirm';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';

import { Button } from './Button';
import { Text } from './Text';

/** Renders the app's dialogs and toasts (see lib/confirm). Mounted once in the root layout. */
export function DialogHost() {
  const { dialog, toast } = useDialogState();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Modal transparent visible={dialog != null} animationType="none" onRequestClose={() => closeDialog(false)} statusBarTranslucent>
        {dialog ? (
          <Animated.View entering={FadeIn.duration(160)} style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => closeDialog(false)} accessibilityLabel="סגירה" />
            <Animated.View key={dialog.id} entering={ZoomIn.springify().damping(18).stiffness(220)} style={styles.dialog} accessibilityRole="alert">
              <View style={[styles.icon, dialog.destructive && { backgroundColor: colors.dangerSoft }]}>
                <Feather name={dialog.destructive ? 'alert-triangle' : 'help-circle'} size={22} color={dialog.destructive ? colors.danger : colors.accent} />
              </View>
              <Text variant="h2" align="center" style={{ fontSize: 21 }}>
                {dialog.title}
              </Text>
              {dialog.message ? (
                <Text variant="body" color={colors.inkSoft} align="center">
                  {dialog.message}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Button variant="ghost" label={dialog.cancelLabel} onPress={() => closeDialog(false)} style={{ flex: 1 }} />
                <Button
                  label={dialog.confirmLabel}
                  onPress={() => closeDialog(true)}
                  style={dialog.destructive ? { flex: 1.4, backgroundColor: colors.danger, boxShadow: 'none' } : { flex: 1.4 }}
                />
              </View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Modal>

      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.springify().damping(18)}
          exiting={FadeOutDown.duration(180)}
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: insets.bottom + 86 }]}>
          <Pressable onPress={dismissToast} style={[styles.toast, toast.kind === 'error' && styles.toastError]} accessibilityRole="alert">
            <View style={[styles.toastIcon, toast.kind === 'error' && { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <Feather name={toast.kind === 'error' ? 'alert-circle' : toast.kind === 'info' ? 'info' : 'check'} size={15} color={colors.inverse} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label" color={colors.inverse} style={{ fontFamily: fonts.bodyMedium }}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text variant="caption" color="rgba(255,255,255,0.8)" numberOfLines={3}>
                  {toast.message}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, backgroundColor: 'rgba(36, 18, 15, 0.5)' },
  dialog: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.xl,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    ...shadow.lg,
  },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft },
  actions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
  toastWrap: { position: 'absolute', left: space.md, right: space.md, alignItems: 'center', zIndex: 1000 },
  toast: {
    width: '100%',
    maxWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.night,
    ...shadow.lg,
  },
  toastError: { backgroundColor: colors.danger },
  toastIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});
