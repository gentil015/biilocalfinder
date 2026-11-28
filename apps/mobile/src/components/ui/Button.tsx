import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/src/theme/ThemeProvider';
import { hit, radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  size = 'md',
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'secondary'
          ? colors.primarySoft
          : 'transparent';
  const textColor =
    variant === 'primary' || variant === 'danger' ? colors.white : colors.primaryDark;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        style,
        size === 'sm' && styles.small,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: background,
          opacity: isDisabled ? 0.5 : pressed ? 0.88 : 1,
          borderColor: variant === 'secondary' ? colors.primary : colors.border,
        },
        variant === 'secondary' && styles.border,
        variant === 'primary' && styles.primaryShadow,
      ]}
    >
      <View style={[styles.content, loading && styles.hiddenContent]}>
        {icon}
        <Text style={[typography.button, { color: textColor }]}>{label}</Text>
      </View>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={textColor} size="small" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: hit.min, paddingHorizontal: spacing.md },
  fullWidth: { width: '100%' },
  border: { borderWidth: 1 },
  primaryShadow: elevation.subtle,
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hiddenContent: { opacity: 0 },
  loadingOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
