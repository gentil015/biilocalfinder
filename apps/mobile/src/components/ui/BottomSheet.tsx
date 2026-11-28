import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { useTheme } from '@/src/theme/ThemeProvider';
import { hit, radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';
import { IconButton } from './IconButton';

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ visible, title, onClose, children, footer }: BottomSheetProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View accessible={false} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable accessible={false} importantForAccessibility="no" style={styles.dismiss} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboard}
        >
          <View accessible accessibilityViewIsModal accessibilityLabel={title} style={[styles.sheet, { backgroundColor: colors.surfaceElevated }, elevation.overlay]}>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            </View>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[typography.h3, { color: colors.text }]}>{title}</Text>
              <IconButton icon={<X size={18} />} label="Close sheet" variant="ghost" size={hit.min} onPress={onClose} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismiss: { position: 'absolute', inset: 0 },
  keyboard: { maxHeight: '86%' },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  handleWrap: { alignItems: 'center', paddingTop: spacing.sm },
  handle: { width: 42, height: 4, borderRadius: radius.pill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
});
