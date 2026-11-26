import { CalendarDays, CreditCard } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/src/components/ui/Badges';
import { Card } from '@/src/components/ui/Card';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import type { BookingItem } from '@/src/types/api';
import { formatDate, formatMoney, statusLabel } from '@/src/utils/format';

export function BookingCard({ booking, onPress }: { booking: BookingItem; onPress?: () => void }) {
  const { colors } = useTheme();
  const content = (
    <>
      <View style={styles.header}>
        <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={2}>
          {booking.request?.title ?? 'Service booking'}
        </Text>
        <Badge
          label={statusLabel.booking(booking.status)}
          tone={booking.status === 'COMPLETED' ? 'success' : booking.status === 'CANCELLED' ? 'danger' : 'accent'}
        />
      </View>
      <Text style={[typography.small, { color: colors.textMuted }]}>
        {booking.provider?.businessName ?? booking.client?.firstName ?? 'Professional'}
      </Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <CalendarDays size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {formatDate(booking.scheduledAt ?? booking.createdAt)}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <CreditCard size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {formatMoney(booking.agreedPrice, booking.currency)}
          </Text>
        </View>
      </View>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>{content}</Card>
    </Pressable>
  ) : (
    <Card>{content}</Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
