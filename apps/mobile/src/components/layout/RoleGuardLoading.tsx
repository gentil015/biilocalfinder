import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { elevation } from '@/src/theme/elevation';

export function RoleGuardLoading({ label = 'Preparing your workspace…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} accessibilityRole="alert">
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, elevation.raised]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[typography.h3, { color: colors.text }]}>BII LocalFinder</Text>
        <Text style={[typography.small, { color: colors.textSecondary, textAlign: 'center' }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
});
