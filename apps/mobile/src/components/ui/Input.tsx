import { StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  multiline,
  numberOfLines,
  editable = true,
  hint,
  containerStyle,
}: InputProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text> : null}
      <TextInput
        accessible
        accessibilityLabel={label ?? placeholder}
        autoCapitalize={autoCapitalize}
        editable={editable}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={numberOfLines}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          multiline && styles.multiline,
          typography.body,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
        ]}
        value={value}
      />
      {hint && !error ? <Text style={[typography.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
      {error ? <Text style={[typography.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
});
