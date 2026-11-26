import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

interface MenuRowProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  value?: string;
  destructive?: boolean;
}

export function MenuRow({ icon, label, onPress, value, destructive = false }: MenuRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={value ? `Current value ${value}` : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface }, pressed && styles.pressed]}
    >
      <View style={styles.leading}>
        {icon}
        <Text style={[typography.body, { color: destructive ? colors.danger : colors.text, flex: 1 }]}>
          {label}
        </Text>
      </View>
      {value ? (
        <Text numberOfLines={1} style={[typography.small, { color: colors.textMuted, maxWidth: 140 }]}>
          {value}
        </Text>
      ) : null}
      <ChevronRight size={18} color={destructive ? colors.danger : colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pressed: { opacity: 0.7 },
});
