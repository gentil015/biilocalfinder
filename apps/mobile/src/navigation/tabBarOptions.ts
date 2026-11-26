import { elevation } from '@/src/theme/elevation';
import { layout, spacing, typography } from '@/src/theme/metrics';
import type { AppColors } from '@/src/theme/colors';

export function getTabScreenOptions(colors: AppColors, bottomInset = 0) {
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.surfaceElevated,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: layout.tabBarHeight + bottomInset,
      paddingBottom: spacing.sm + bottomInset,
      paddingTop: spacing.sm,
      ...elevation.subtle,
    },
    tabBarLabelStyle: {
      fontSize: typography.caption.fontSize,
      lineHeight: typography.caption.lineHeight,
      fontWeight: '600' as const,
    },
    tabBarIconStyle: { marginBottom: 2 },
    tabBarItemStyle: { paddingHorizontal: spacing.xs },
  };
}
