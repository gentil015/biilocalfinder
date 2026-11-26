import { Calendar, Check, Clock, X } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { formatDate, formatMoney, statusLabel } from '@/src/utils/format';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { QuoteItem } from '@/src/types/api';

export function QuoteCard({
  quote,
  showActions = false,
  accepting = false,
  rejecting = false,
  onAccept,
  onReject,
  selected = false,
}: {
  quote: QuoteItem;
  showActions?: boolean;
  accepting?: boolean;
  rejecting?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  const name = quote.provider?.businessName ?? 'Professional';
  const tone = quote.status === 'ACCEPTED' ? 'success' : quote.status === 'PENDING' ? 'accent' : quote.status === 'REJECTED' ? 'danger' : 'neutral';
  return (
    <Card variant={selected ? 'elevated' : 'default'} style={selected ? { borderColor: colors.primary } : undefined}>
      <View style={styles.header}>
        <Avatar uri={quote.provider?.avatarUrl} name={name} size={44} />
        <View style={styles.identity}>
          <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {quote.provider?.rating ? `★ ${Number(quote.provider.rating).toFixed(1)} · ${quote.provider.reviewCount ?? 0} reviews` : 'New provider'}
          </Text>
        </View>
        <Badge label={statusLabel.quote(quote.status)} tone={tone} />
      </View>
      <View style={[styles.priceRow, { backgroundColor: colors.surfaceAlt }]}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Quoted price</Text>
          <Text style={[typography.h2, { color: colors.primaryDark }]}>{formatMoney(quote.price, quote.currency)}</Text>
        </View>
        {quote.proposedDate ? (
          <View style={styles.metaItem}>
            <Calendar size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{formatDate(quote.proposedDate)}</Text>
          </View>
        ) : null}
        {quote.estimatedDuration ? (
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textSecondary }]}>{String(quote.estimatedDuration)}</Text>
          </View>
        ) : null}
      </View>
      {quote.description ? <Text style={[typography.small, { color: colors.textSecondary }]}>{quote.description}</Text> : null}
      {quote.materials ? (
        <View style={styles.items}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Materials</Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>{quote.materials}</Text>
        </View>
      ) : null}
      {quote.expiresAt ? <Text style={[typography.caption, { color: colors.textMuted }]}>Valid until {formatDate(quote.expiresAt)}</Text> : null}
      {quote.includedItems?.length ? (
        <View style={styles.items}>
          {quote.includedItems.slice(0, 3).map((item, i) => (
            <View key={`${item}-${i}`} style={[styles.itemPill, { backgroundColor: colors.successSoft }]}>
              <Text style={[typography.caption, { color: colors.success }]} numberOfLines={1}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {quote.excludedItems?.length ? (
        <View style={styles.items}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Not included</Text>
          <View style={styles.items}>
            {quote.excludedItems.slice(0, 3).map((item, i) => (
              <View key={`${item}-${i}`} style={[styles.itemPill, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[typography.caption, { color: colors.danger }]} numberOfLines={1}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {quote.attachments?.length ? (
        <View style={styles.items}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>Attachments</Text>
          {quote.attachments.map((attachment, index) => {
            const name = attachment.fileName ?? attachment.storageKey;
            return attachment.url ? (
              <Pressable
                key={`${attachment.storageKey}-${index}`}
                accessibilityRole="link"
                accessibilityLabel={`Open ${name}`}
                onPress={() => void Linking.openURL(attachment.url!)}
              >
                <Text style={[typography.caption, { color: colors.primaryDark, textDecorationLine: 'underline' }]} numberOfLines={1}>{name}</Text>
              </Pressable>
            ) : (
              <Text key={`${attachment.storageKey}-${index}`} style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>{name}</Text>
            );
          })}
        </View>
      ) : null}
      {showActions && quote.status === 'PENDING' && onAccept && onReject ? (
        <View style={styles.actions}>
          <Button
            label="Accept"
            size="sm"
            icon={<Check size={15} />}
            loading={accepting}
            disabled={accepting || rejecting}
            onPress={onAccept}
          />
          <Button
            label="Decline"
            size="sm"
            variant="secondary"
            icon={<X size={15} />}
            loading={rejecting}
            disabled={accepting || rejecting}
            onPress={onReject}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identity: { flex: 1, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  itemPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, maxWidth: '100%' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
