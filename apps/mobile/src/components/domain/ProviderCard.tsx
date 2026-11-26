import { BadgeCheck, Heart, MapPin, Shield } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AvailabilityBadge, AvailabilityDetails, Avatar, Badge, RatingRow, VerificationBadge } from '@/src/components/ui/Badges';
import { Card } from '@/src/components/ui/Card';
import { formatMoney, truncate } from '@/src/utils/format';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import type { ProviderDetail } from '@/src/types/api';

export function ProviderCard({
  provider,
  onPress,
  onFavorite,
  isFavorite = false,
}: {
  provider: ProviderDetail;
  onPress: () => void;
  onFavorite?: () => void;
  isFavorite?: boolean;
}) {
  const { colors } = useTheme();
  const imageUri = provider.logoUrl ?? provider.avatarUrl;
  const locationLabel = [provider.location?.city ?? provider.city, provider.distanceKm != null ? `${provider.distanceKm.toFixed(1)} km` : null]
    .filter(Boolean)
    .join(' · ');
  const verifiedCount = provider.verifiedReviewCount;
  const responsePct = provider.responseRateSummary?.percentage;

  return (
    <Card onPress={onPress} variant="elevated" style={styles.card}>
      <View style={styles.top}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <Avatar uri={provider.avatarUrl} name={provider.businessName} size={56} />
        )}
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {provider.businessName}
            </Text>
            {provider.businessVerified ? <BadgeCheck size={16} color={colors.primary} /> : null}
          </View>
          {typeof provider.rating === 'number' && Number.isFinite(provider.rating) && provider.rating > 0 ? (
            <RatingRow
              rating={provider.rating}
              count={typeof provider.reviewCount === 'number' ? provider.reviewCount : undefined}
            />
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Not enough data yet</Text>
          )}
          <View style={styles.badges}>
            <VerificationBadge status={provider.verificationStatus} />
            <AvailabilityBadge status={provider.availabilityStatus} />
          </View>
        </View>
        {onFavorite ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            accessibilityState={{ selected: isFavorite }}
            onPress={onFavorite}
            hitSlop={8}
            style={[styles.favorite, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          >
            <Heart size={18} color={isFavorite ? colors.danger : colors.textMuted} fill={isFavorite ? colors.danger : 'transparent'} />
          </Pressable>
        ) : null}
      </View>
      {provider.description || provider.bio ? (
        <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={2}>
          {truncate(provider.description ?? provider.bio ?? '', 140)}
        </Text>
      ) : null}
      <View style={styles.details}>
        <AvailabilityDetails
          nextAvailableLabel={provider.availability?.nextAvailableLabel}
          todayHours={provider.availability?.todayHours}
        />
        <View style={styles.chips}>
          <Badge
            label={verifiedCount != null ? `${verifiedCount} verified reviews` : 'Verified reviews: —'}
            tone={verifiedCount ? 'success' : 'neutral'}
          />
          <Badge
            label={responsePct != null ? `${Math.round(responsePct)}% response rate` : 'Response rate: —'}
            tone={responsePct != null ? 'accent' : 'neutral'}
          />
        </View>
      </View>
      <View style={styles.meta}>
        <View style={styles.pricePill}>
          <Text style={[typography.caption, { color: colors.primaryDark, fontWeight: '700' }]}>
            {formatMoney(provider.startingPrice, provider.currency)}
          </Text>
        </View>
        {locationLabel ? (
          <View style={styles.distance}>
            <MapPin size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{locationLabel}</Text>
          </View>
        ) : provider.servesArea ? (
          <View style={styles.distance}>
            <Shield size={13} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted }]}>Serves your area</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  heroImage: { width: 56, height: 56, borderRadius: radius.md },
  identity: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: 2 },
  details: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  favorite: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  pricePill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  distance: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
});
