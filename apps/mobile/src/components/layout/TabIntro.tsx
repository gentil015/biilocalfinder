import { Text, View } from 'react-native';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState } from '@/src/components/ui/States';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

export function TabIntro({ title, subtitle, emptyTitle, emptyMessage }: {
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.h1, { color: colors.text }]}>{title}</Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
        <EmptyState title={emptyTitle} message={emptyMessage} />
      </View>
    </Screen>
  );
}
