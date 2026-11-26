import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { Button } from './Button';

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {icon}
      <Text style={[typography.h3, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[typography.small, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = 'Something went wrong',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Text style={[typography.h3, { color: colors.danger, textAlign: 'center' }]}>{title}</Text>
      <Text style={[typography.small, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    minHeight: 120,
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
