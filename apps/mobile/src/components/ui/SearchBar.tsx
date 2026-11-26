import { Search, X } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';
import { IconButton } from './IconButton';

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  onClear?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search…',
  onSubmitEditing,
  onClear,
}: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        elevation.subtle,
      ]}
    >
      <Search size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        style={[typography.body, { color: colors.text, flex: 1 }]}
      />
      {value.length > 0 ? (
        <IconButton
          icon={<X size={18} />}
          label="Clear search"
          size={32}
          variant="ghost"
          onPress={onClear ?? (() => onChangeText(''))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
