import { TriangleAlert } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '@/src/hooks/useReducedMotion';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';
import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View accessible={false} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable accessibilityLabel="Close dialog" style={styles.dismiss} onPress={onCancel} />
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }, elevation.overlay]}>
          <View style={[styles.iconWrap, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>
            <TriangleAlert size={22} color={destructive ? colors.danger : colors.primary} />
          </View>
          <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dismiss: { position: 'absolute', inset: 0 },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
