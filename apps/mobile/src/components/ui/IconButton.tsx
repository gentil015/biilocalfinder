import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';

interface IconButtonProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'surface' | 'ghost' | 'primary';
  tone?: 'default' | 'danger';
  size?: number;
  disabled?: boolean;
  badgeCount?: number;
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'surface',
  tone = 'default',
  size = 44,
  disabled = false,
  badgeCount,
}: IconButtonProps) {
  const { colors, borderWidth } = useTheme();
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'surface'
        ? colors.surfaceElevated
        : 'transparent';
  const foreground =
    variant === 'primary'
      ? colors.textOnPrimary
      : tone === 'danger'
        ? colors.danger
        : colors.text;
  const iconNode = isValidElement<{ color?: string }>(icon)
    ? cloneElement(icon as ReactElement<{ color?: string }>, {
        color: icon.props.color ?? foreground,
      })
    : icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, backgroundColor: background, borderColor: colors.border },
        borderWidth.thin && variant === 'surface' ? styles.border : null,
        variant === 'surface' ? elevation.subtle : null,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {iconNode}
      {typeof badgeCount === 'number' && badgeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text style={[styles.badgeText, { color: colors.white }]}>
            {badgeCount > 9 ? '9+' : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  border: { borderWidth: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
