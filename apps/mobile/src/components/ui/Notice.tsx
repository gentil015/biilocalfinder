import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

export type NoticeTone = 'success' | 'error' | 'warning' | 'info';

const icons = {
  success: CircleCheck,
  error: CircleX,
  warning: TriangleAlert,
  info: Info,
};

export function Notice({ message, tone = 'info' }: { message: string | null; tone?: NoticeTone }) {
  const { colors } = useTheme();
  if (!message) return null;

  const background = {
    success: colors.successSoft,
    error: colors.dangerSoft,
    warning: colors.warningSoft,
    info: colors.infoSoft,
  }[tone];
  const foreground = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.info,
  }[tone];
  const Icon = icons[tone];

  return (
    <View
      style={[styles.notice, { backgroundColor: background }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={foreground} />
      <Text style={[typography.small, { color: foreground, flex: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
});
