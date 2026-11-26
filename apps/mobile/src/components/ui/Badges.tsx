import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing } from '@/src/theme/metrics';
import type { AvailabilityStatus, VerificationStatus } from '@/src/types/api';

export function Avatar({
  uri,
  name,
  size = 48,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const { colors, typography } = useTheme();
  const initials = name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!uri) {
    return (
      <View
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft },
        ]}
      >
        <Text style={[typography.bodyStrong, { color: colors.primaryDark }]}>{initials || 'BII'}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, styles.avatar]}
      contentFit="cover"
      cachePolicy="memory-disk"
    />
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  const { colors, typography } = useTheme();
  const background = {
    neutral: colors.surfaceAlt,
    success: colors.primarySoft,
    warning: colors.warningSoft,
    danger: colors.dangerSoft,
    accent: colors.goldSoft,
  }[tone];
  const foreground = {
    neutral: colors.textSecondary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    accent: colors.text,
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[typography.caption, { color: foreground }]}>{label}</Text>
    </View>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const label: Record<VerificationStatus, string> = {
    UNVERIFIED: 'Not verified',
    PENDING: 'Verification pending',
    VERIFIED: 'Verified',
    REJECTED: 'Verification rejected',
    SUSPENDED: 'Verification suspended',
    EXPIRED: 'Verification expired',
  };
  const tone =
    status === 'VERIFIED'
      ? 'success'
      : status === 'PENDING'
        ? 'warning'
        : status === 'UNVERIFIED'
          ? 'neutral'
          : 'danger';
  return <Badge label={label[status] ?? label.UNVERIFIED} tone={tone} />;
}

export function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const label: Record<AvailabilityStatus, string> = {
    AVAILABLE: 'Available',
    BUSY: 'Busy',
    UNAVAILABLE: 'Unavailable',
  };
  const tone = status === 'AVAILABLE' ? 'success' : status === 'BUSY' ? 'warning' : 'neutral';
  return <Badge label={label[status] ?? label.AVAILABLE} tone={tone} />;
}

export function RatingRow({ rating, count }: { rating: number | string; count?: number }) {
  const { colors, typography } = useTheme();
  const value = typeof rating === 'number' ? rating : Number(rating) || 0;
  return (
    <View style={styles.row}>
      <Star size={14} color={colors.gold} fill={colors.gold} />
      <Text style={[typography.small, { color: colors.text }]}>{value.toFixed(1)}</Text>
      {typeof count === 'number' ? (
        <Text style={[typography.caption, { color: colors.textMuted }]}>({count})</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
