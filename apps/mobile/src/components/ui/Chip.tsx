import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { hit, radius, spacing, typography } from '@/src/theme/metrics';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'neutral';
}

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  tone = 'primary',
}: ChipProps) {
  const { colors, borderWidth } = useTheme();
  const background = selected
    ? tone === 'primary'
      ? colors.primary
      : colors.surfaceElevated
    : colors.surfaceAlt;
  const foreground = selected
    ? tone === 'primary'
      ? colors.textOnPrimary
      : colors.primaryDark
    : colors.textSecondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: background, borderColor: selected ? background : colors.border },
        borderWidth.thin ? styles.border : null,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[typography.small, { color: foreground, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: hit.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  border: { borderWidth: 1 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.5 },
});
