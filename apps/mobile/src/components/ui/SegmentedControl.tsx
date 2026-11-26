import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected && [styles.selected, { backgroundColor: colors.surfaceElevated }],
              selected && elevation.subtle,
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.small,
                { color: selected ? colors.primaryDark : colors.textSecondary, fontWeight: '600' },
              ]}
            >
              {option.label}
              {typeof option.count === 'number' ? ` · ${option.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  selected: { borderRadius: radius.sm },
  pressed: { opacity: 0.7 },
});
