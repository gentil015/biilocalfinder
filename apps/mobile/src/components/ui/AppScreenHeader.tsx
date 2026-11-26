import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { IconButton } from './IconButton';

interface AppScreenHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
  onBack?: () => void;
  large?: boolean;
}

export function AppScreenHeader({
  title,
  eyebrow,
  subtitle,
  action,
  back = true,
  onBack,
  large = false,
}: AppScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={styles.header} accessibilityRole="header">
      <View style={styles.leading}>
        {back ? (
          <IconButton
            icon={<ArrowLeft size={20} />}
            label={`Go back from ${title}`}
            onPress={onBack ?? (() => router.back())}
          />
        ) : null}
        <View style={styles.text}>
          {eyebrow ? (
            <Text style={[typography.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              large ? typography.h1 : typography.h2,
              { color: colors.text },
              !back && styles.standaloneTitle,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={[typography.small, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  leading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  text: { flex: 1, gap: spacing.xs },
  action: { flexShrink: 0 },
  standaloneTitle: { marginLeft: spacing.xs },
});
