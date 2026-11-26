import { BadgeCheck, Star } from 'lucide-react-native';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/src/components/ui/Badges';
import { Card } from '@/src/components/ui/Card';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { ReviewItem } from '@/src/types/api';
import { formatDate } from '@/src/utils/format';

function Subrating({ label, value }: { label: string; value?: number | null }) {
  const { colors } = useTheme();
  if (value == null) return null;
  return (
    <View style={[styles.subrating, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{value.toFixed(1)}</Text>
    </View>
  );
}

export function ReviewCard({ review }: { review: ReviewItem }) {
  const { colors } = useTheme();
  const photos = review.photos?.map((p) => p.url ?? p.storageKey).filter((u): u is string => Boolean(u)) ?? [];
  const hasRating = typeof review.rating === 'number' && Number.isFinite(review.rating) && review.rating > 0;
  const response = review.response;
  return (
    <Card variant="muted">
      <View style={styles.header}>
        <Avatar uri={review.reviewer?.avatarUrl} name={review.reviewer?.name ?? 'Client'} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {review.reviewer?.name ?? 'Client'}
            </Text>
            {review.isVerified ? (
              <View style={[styles.verified, { backgroundColor: colors.successSoft }]}>
                <BadgeCheck size={12} color={colors.success} />
                <Text style={[typography.caption, { color: colors.success, fontWeight: '600' }]}>Verified</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.stars}>
            {hasRating ? (
              Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={13}
                  color={index < review.rating ? colors.gold : colors.borderStrong}
                  fill={index < review.rating ? colors.gold : 'transparent'}
                />
              ))
            ) : (
              <Text style={[typography.caption, { color: colors.textMuted }]}>Not enough data yet</Text>
            )}
            <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(review.createdAt)}</Text>
          </View>
        </View>
      </View>
      {review.comment ? <Text style={[typography.small, { color: colors.textSecondary }]}>{review.comment}</Text> : null}
      <View style={styles.subratings}>
        <Subrating label="Quality" value={review.qualityRating} />
        <Subrating label="Communication" value={review.communicationRating} />
        <Subrating label="Professionalism" value={review.professionalismRating} />
        <Subrating label="Value" value={review.valueRating} />
      </View>
      {photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
          {photos.map((uri, i) => (
            <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" />
          ))}
        </ScrollView>
      ) : null}
      {response?.text ? (
        <View style={[styles.response, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}>
          <View style={styles.responseHead}>
            <Text style={[typography.caption, { color: colors.primaryDark, fontWeight: '600' }]}>Provider response</Text>
            {response.createdAt ? (
              <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(response.createdAt)}</Text>
            ) : null}
          </View>
          <Text style={[typography.small, { color: colors.textSecondary }]}>{response.text}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  subratings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  subrating: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  photos: { gap: spacing.sm },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
  response: { borderLeftWidth: 2, padding: spacing.md, borderRadius: radius.sm, gap: spacing.xs },
  responseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
});
