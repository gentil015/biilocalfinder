import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';

export function Card({
  children,
  style,
  onPress,
  variant = 'default',
  accessibilityLabel,
  accessibilityState,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'default' | 'elevated' | 'muted';
  accessibilityLabel?: AccessibilityProps['accessibilityLabel'];
  accessibilityState?: AccessibilityProps['accessibilityState'];
}) {
  const { colors } = useTheme();
  const background =
    variant === 'muted' ? colors.surfaceAlt : variant === 'elevated' ? colors.surfaceElevated : colors.surface;
  const cardStyle = [
    styles.card,
    { backgroundColor: background, borderColor: colors.border },
    variant === 'elevated' && elevation.subtle,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState} style={cardStyle}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  action?: ReactNode;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[typography.small, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: { flexShrink: 1, gap: spacing.xs },
  pressed: { opacity: 0.85 },
});
