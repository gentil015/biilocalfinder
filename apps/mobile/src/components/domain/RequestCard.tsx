import { CalendarDays, MessageSquareText } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/src/components/ui/Badges';
import { Card } from '@/src/components/ui/Card';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import type { ServiceRequestItem } from '@/src/types/api';
import { formatDate, formatMoney, statusLabel, truncate } from '@/src/utils/format';

const toneFor = (status: string) =>
  status === 'CANCELLED' || status === 'EXPIRED'
    ? 'danger'
    : status === 'BOOKED' || status === 'ACCEPTED'
      ? 'success'
      : status === 'QUOTED' || status === 'NEGOTIATING'
        ? 'accent'
        : 'neutral';

export function RequestCard({ request, onPress }: { request: ServiceRequestItem; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <Text style={[typography.h3, { color: colors.text, flex: 1 }]} numberOfLines={2}>
          {request.title}
        </Text>
        <Badge label={statusLabel.request(request.status)} tone={toneFor(request.status)} />
      </View>
      <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>
        {truncate(request.description, 140)}
      </Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <CalendarDays size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(request.preferredDate)}</Text>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{formatMoney(request.budgetMax ?? request.budgetMin)}</Text>
        <View style={styles.metaItem}>
          <MessageSquareText size={14} color={colors.textMuted} />
          <Text style={[typography.caption, { color: colors.textMuted }]}>{request.quotes?.length ?? 0} quotes</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
