import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, Heart, MapPin, MessageCircle, Phone, Shield, Star } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ReviewCard } from '@/src/components/domain/ReviewCard';
import { Avatar, AvailabilityBadge, VerificationBadge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { IconButton } from '@/src/components/ui/IconButton';
import { Notice } from '@/src/components/ui/Notice';
import { ListSkeleton, ProfileSkeleton } from '@/src/components/ui/Skeleton';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { discoveryApi } from '@/src/services/api/endpoints/discovery';
import { messagingApi } from '@/src/services/api/endpoints/messaging';
import { toApiError } from '@/src/services/api/errors';
import { queryKeys, useFavorites, useProvider, useProviderReviews } from '@/src/hooks/queries';
import { useTheme } from '@/src/theme/ThemeProvider';
import { elevation } from '@/src/theme/elevation';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { formatMoney, truncate } from '@/src/utils/format';

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | undefined>();
  const provider = useProvider(id);
  const reviews = useProviderReviews(id);
  const favorites = useFavorites();
  const isFavorite = Boolean(favorites.data?.some((item) => item.id === id));

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      if (isFavorite) await discoveryApi.removeFavorite(id!);
      else await discoveryApi.addFavorite(id!);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.favorites }),
    onError: (error) => setNotice(toApiError(error).message),
  });

  const messageMutation = useMutation({
    mutationFn: () => messagingApi.createConversation(id!),
    onSuccess: (conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } }),
    onError: (error) => setNotice(toApiError(error).message),
  });

  const contactMutation = useMutation({
    mutationFn: () => discoveryApi.providerContact(id!),
    onSuccess: (contact) => {
      const value = contact.phone ?? contact.email;
      setNotice(value ? `Contact: ${value}` : 'No contact details are available yet.');
    },
    onError: () => setNotice('Contact details unlock after a booking is accepted.'),
  });

  const data = provider.data;
  const offerings = data?.serviceOfferings ?? [];
  const activeOffering = useMemo(() => offerings.find((o) => o.id === selectedOfferingId) ?? offerings[0], [offerings, selectedOfferingId]);
  const serviceId = activeOffering?.service?.id ?? offerings[0]?.service?.id;
  const serviceOfferingId = activeOffering?.id;

  if (provider.isLoading) {
    return <Screen><AppScreenHeader title="Provider" /><ProfileSkeleton /><ListSkeleton rows={2} /></Screen>;
  }
  if (provider.isError || !data) {
    return <Screen><AppScreenHeader title="Provider" /><ErrorState message="This provider profile could not be loaded." onRetry={() => void provider.refetch()} /></Screen>;
  }

  const locationLabel = [data.location?.label, data.location?.city, data.city].filter(Boolean).join(', ') || (data.serviceAreas?.length ? `Serves ${data.serviceAreas.length} area${data.serviceAreas.length === 1 ? '' : 's'}` : null);
  const responsePct = data.responseRateSummary?.percentage;
  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={[styles.heroWrap, { backgroundColor: colors.primary }]}>
          <View style={styles.heroTop}>
            <AppScreenHeader title="" back onBack={() => router.back()} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove favorite' : 'Add favorite'}
              accessibilityState={{ selected: isFavorite, disabled: favoriteMutation.isPending }}
              disabled={favoriteMutation.isPending}
              onPress={() => favoriteMutation.mutate()}
              style={({ pressed }) => [styles.favoriteButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, elevation.subtle, pressed && styles.pressed]}
            >
              <Heart size={20} color={isFavorite ? colors.danger : colors.text} fill={isFavorite ? colors.danger : 'transparent'} />
            </Pressable>
          </View>
          <View style={styles.hero}>
            {data.logoUrl || data.avatarUrl ? (
              <Image source={{ uri: data.logoUrl ?? data.avatarUrl ?? undefined }} style={styles.heroAvatar} contentFit="cover" />
            ) : (
              <Avatar uri={data.avatarUrl} name={data.businessName} size={76} />
            )}
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[typography.h2, { color: colors.white }]}>{data.businessName}</Text>
              <View style={styles.badges}>
                <VerificationBadge status={data.verificationStatus} />
                <AvailabilityBadge status={data.availabilityStatus} />
              </View>
              <View style={styles.rating}>
                <Star size={15} color={colors.gold} fill={colors.gold} />
                <Text style={[typography.small, { color: colors.white }]}>
                  {typeof data.rating === 'number' && Number.isFinite(data.rating)
                    ? `${data.rating.toFixed(1)}${typeof data.reviewCount === 'number' ? ` (${data.reviewCount} reviews)` : ''}`
                    : 'Not enough data yet'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {notice ? <Notice message={notice} tone={notice.startsWith('Contact:') ? 'info' : 'warning'} /> : null}
          {data.description || data.bio ? <Text style={[typography.body, { color: colors.textSecondary }]}>{data.description ?? data.bio}</Text> : null}

          <View style={styles.stats}>
            <Stat label="Experience" value={typeof data.yearsOfExperience === 'number' ? `${data.yearsOfExperience} yrs` : '—'} icon={<Clock size={14} color={colors.primary} />} />
            <Stat label="Jobs done" value={typeof data.completedJobCount === 'number' ? String(data.completedJobCount) : '—'} icon={<BadgeCheck size={14} color={colors.primary} />} />
            <Stat label="Response" value={responsePct != null ? `${Math.round(responsePct)}%` : '—'} icon={<Shield size={14} color={colors.primary} />} />
          </View>

          <Card variant="muted">
            <View style={{ gap: spacing.sm }}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Trust & service area</Text>
              {locationLabel ? (
                <View style={styles.locationRow}><MapPin size={16} color={colors.primary} /><Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>{locationLabel}</Text></View>
              ) : null}
              {data.businessVerified ? (
                <View style={styles.locationRow}><BadgeCheck size={16} color={colors.success} /><Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>Business verified by BII LocalFinder</Text></View>
              ) : null}
              {data.serviceAreas?.length ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>Service areas: {data.serviceAreas.map((a) => a.label).filter(Boolean).slice(0, 3).join(', ')}{data.serviceAreas.length > 3 ? ` +${data.serviceAreas.length - 3}` : ''}</Text>
              ) : null}
            </View>
          </Card>

          <View>
            <SectionHeader title="Services offered" subtitle={activeOffering ? `Selected: ${activeOffering.title ?? activeOffering.service?.name ?? 'Service'}` : undefined} />
            {offerings.length ? (
              <View style={{ gap: spacing.sm }}>
                {offerings.map((offering) => {
                  const selected = (activeOffering?.id ?? offerings[0]?.id) === offering.id;
                  return (
                    <Card key={offering.id} onPress={() => setSelectedOfferingId(offering.id)} style={selected ? { borderColor: colors.primary } : undefined}>
                      <View style={styles.row}>
                        <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>{offering.title ?? offering.service?.name ?? 'Service'}</Text>
                        <Text style={[typography.bodyStrong, { color: colors.primaryDark }]}>{formatMoney(offering.basePrice, data.currency)}</Text>
                      </View>
                      {offering.description ? <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>{truncate(offering.description, 140)}</Text> : null}
                      {selected ? <Text style={[typography.caption, { color: colors.primaryDark, fontWeight: '600' }]}>Selected for request</Text> : null}
                    </Card>
                  );
                })}
              </View>
            ) : (
              <EmptyState title="No offerings listed" message="Contact this provider to discuss your service." />
            )}
          </View>

          <View>
            <SectionHeader title="Client reviews" subtitle={typeof data.reviewCount === 'number' ? `${data.reviewCount} total` : 'Not enough data yet'} />
            {reviews.isError ? (
              <ErrorState message="Reviews could not be loaded." onRetry={() => void reviews.refetch()} />
            ) : reviews.isLoading ? (
              <ListSkeleton rows={2} />
            ) : reviews.data?.items.length ? (
              <View style={{ gap: spacing.sm }}>
                {reviews.data.items.slice(0, 5).map((review) => <ReviewCard key={review.id} review={review} />)}
              </View>
            ) : (
              <EmptyState title="No reviews yet" message="Reviews appear here after completed bookings." />
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
        <Button
          label="Request service"
          onPress={() => router.push({ pathname: '/request/new', params: { providerId: id!, ...(serviceId ? { serviceId } : {}), ...(serviceOfferingId ? { serviceOfferingId } : {}) } })}
          style={{ flex: 1 }}
        />
        <IconButton icon={<MessageCircle size={20} />} label="Message provider" onPress={() => messageMutation.mutate()} disabled={messageMutation.isPending} />
        <IconButton icon={<Phone size={20} />} label="Contact provider" onPress={() => contactMutation.mutate()} disabled={contactMutation.isPending} />
      </View>
    </Screen>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statHead}>{icon}<Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text></View>
      <Text style={[typography.h3, { color: colors.primaryDark }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  heroAvatar: { width: 76, height: 76, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1 },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  pressed: { opacity: 0.72 },
});
