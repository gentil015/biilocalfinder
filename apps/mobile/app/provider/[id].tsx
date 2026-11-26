import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, Heart, MapPin, MessageCircle, Phone, Shield, Star } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ProviderServicesCatalogue } from '@/src/components/domain/ProviderServicesCatalogue';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ReviewCard } from '@/src/components/domain/ReviewCard';
import { AvailabilityBadge, AvailabilityDetails, Avatar, Badge, VerificationBadge } from '@/src/components/ui/Badges';
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
import { queryKeys, useFavorites, useProvider, useProviderReviews, useReviewSummary } from '@/src/hooks/queries';
import type {
  OfferingItem,
  ProviderEducation,
  ProviderExperience,
  ProviderPortfolio,
} from '@/src/types/api';
import { useTheme } from '@/src/theme/ThemeProvider';
import { elevation } from '@/src/theme/elevation';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { formatDate, formatMoney, humanize } from '@/src/utils/format';

type AttributeEntry = {
  categoryAttribute?: { name?: string; label?: string } | null;
  textValue?: unknown;
  numberValue?: unknown;
  booleanValue?: unknown;
  jsonValue?: unknown;
  value?: unknown;
  name?: string;
  label?: string;
};

type OfferingAttribute = { key: string; label: string; value: string };

function displayDate(value?: string | null): string {
  if (!value) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? formatDate(value) : value;
}

function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const nested = record.value ?? record.textValue ?? record.numberValue ?? record.booleanValue ?? record.jsonValue;
    if (nested !== undefined) return formatAttributeValue(nested);
    return JSON.stringify(value);
  }
  return String(value);
}

function offeringAttributes(value: OfferingItem['attributeValues']): OfferingAttribute[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return (value as unknown as AttributeEntry[])
      .map((entry, index) => {
        const label = humanize(
          entry.categoryAttribute?.label ?? entry.categoryAttribute?.name ?? entry.label ?? entry.name ?? '',
        );
        const raw = entry.textValue ?? entry.numberValue ?? entry.booleanValue ?? entry.jsonValue ?? entry.value;
        return label ? { key: `${index}`, label, value: formatAttributeValue(raw) } : null;
      })
      .filter((item): item is OfferingAttribute => Boolean(item));
  }
  return Object.entries(value)
    .map(([key, raw]) => ({ key, label: humanize(key), value: formatAttributeValue(raw) }))
    .filter((item) => item.label.length > 0 && item.value !== '—');
}

function periodLabel(start?: string | null, end?: string | null, current?: boolean | null): string {
  return [displayDate(start), current ? 'Present' : displayDate(end)].filter(Boolean).join(' – ');
}

export default function ProviderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | undefined>();
  const provider = useProvider(id);
  const reviews = useProviderReviews(id);
  const reviewSummary = useReviewSummary(id);
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
  const offerings = data?.serviceOfferings?.length ? data.serviceOfferings : (data?.services ?? []);
  const summary = reviewSummary.data ?? data?.reviewSummary ?? null;
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
  const distribution = Object.entries(summary?.distribution ?? {}).filter(([, count]) => typeof count === 'number');
  const subratings = Object.entries(summary?.subratings ?? {}).filter(([, value]) => typeof value === 'number');
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
            {data.logoUrl ? (
              <Image source={{ uri: data.logoUrl }} style={styles.heroAvatar} contentFit="cover" />
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
                  {typeof data.rating === 'number' && Number.isFinite(data.rating) && data.rating > 0
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

          <Card variant="muted">
            <View style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>Availability</Text>
                <AvailabilityBadge status={data.availabilityStatus} />
              </View>
              <AvailabilityDetails
                nextAvailableLabel={data.availability?.nextAvailableLabel}
                todayHours={data.availability?.todayHours}
              />
            </View>
          </Card>

          <ProviderServicesCatalogue
            providerId={id!}
            offerings={offerings}
            selectedId={activeOffering?.id}
            onSelect={(offeringId) => setSelectedOfferingId(offeringId)}
            onBook={(offering) => router.push({
              pathname: '/request/new',
              params: {
                providerId: id!,
                ...(offering.service?.id ? { serviceId: offering.service.id } : serviceId ? { serviceId } : {}),
                serviceOfferingId: offering.id,
              },
            })}
          />

          <View>
            <SectionHeader title="Client reviews" subtitle={summary ? `${summary.total} total` : 'Not enough data yet'} />
            {summary ? (
              <Card variant="muted">
                <View style={styles.summaryGrid}>
                  <SummaryStat label="Average" value={summary.average != null && Number.isFinite(summary.average) ? summary.average.toFixed(1) : '—'} />
                  <SummaryStat label="Reviews" value={String(summary.total)} />
                  <SummaryStat label="Verified" value={summary.verifiedCount != null ? String(summary.verifiedCount) : '—'} />
                  <SummaryStat label="With photos" value={summary.withPhotosCount != null ? String(summary.withPhotosCount) : '—'} />
                </View>
                {distribution.length ? (
                  <View style={styles.summaryRows}>
                    {distribution.map(([label, count]) => (
                      <View key={label} style={styles.summaryRow}>
                        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{humanize(label)}</Text>
                        <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{count}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {subratings.length ? (
                  <View style={styles.summaryRows}>
                    {subratings.map(([label, value]) => (
                      <View key={label} style={styles.summaryRow}>
                        <Text style={[typography.caption, { color: colors.textMuted, flex: 1 }]}>{humanize(label)}</Text>
                        <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]}>{Number(value).toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}
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

          {data.experiences?.length ? (
            <View>
              <SectionHeader title="Work experience" />
              <View style={{ gap: spacing.sm }}>
                {data.experiences.map((experience: ProviderExperience) => {
                  const title = [experience.title, experience.company].filter(Boolean).join(' · ');
                  const period = periodLabel(experience.startDate, experience.endDate, experience.isCurrent);
                  if (!title && !period && !experience.description) return null;
                  return (
                    <Card key={experience.id} variant="muted">
                      {title ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text> : null}
                      {period ? <Text style={[typography.caption, { color: colors.primary }]}>{period}</Text> : null}
                      {experience.description ? (
                        <Text style={[typography.small, { color: colors.textSecondary }]}>{experience.description}</Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}

          {data.educations?.length ? (
            <View>
              <SectionHeader title="Education" />
              <View style={{ gap: spacing.sm }}>
                {data.educations.map((education: ProviderEducation) => {
                  const title = [education.degree, education.fieldOfStudy].filter(Boolean).join(' in ') || education.school;
                  const period = periodLabel(education.startDate, education.endDate, education.isCurrent);
                  if (!title && !period && !education.description) return null;
                  return (
                    <Card key={education.id} variant="muted">
                      {title ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text> : null}
                      {education.school && education.school !== title ? (
                        <Text style={[typography.small, { color: colors.textSecondary }]}>{education.school}</Text>
                      ) : null}
                      {period ? <Text style={[typography.caption, { color: colors.primary }]}>{period}</Text> : null}
                      {education.description ? (
                        <Text style={[typography.small, { color: colors.textSecondary }]}>{education.description}</Text>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}

          {data.portfolios?.length ? (
            <View>
              <SectionHeader title="Portfolio" />
              <View style={{ gap: spacing.md }}>
                {data.portfolios.map((portfolio: ProviderPortfolio) => {
                  const images = portfolio.images ?? [];
                  return (
                    <Card key={portfolio.id} variant="muted">
                      {portfolio.title ? <Text style={[typography.bodyStrong, { color: colors.text }]}>{portfolio.title}</Text> : null}
                      {portfolio.service?.name ? (
                        <Text style={[typography.caption, { color: colors.primary }]}>{portfolio.service.name}</Text>
                      ) : null}
                      {portfolio.description ? (
                        <Text style={[typography.small, { color: colors.textSecondary }]}>{portfolio.description}</Text>
                      ) : null}
                      {portfolio.projectDate ? (
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{displayDate(portfolio.projectDate)}</Text>
                      ) : null}
                      {portfolio.isBeforeAfter ? <Badge label="Before & after" tone="accent" /> : null}
                      {images.length ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.portfolioImages}>
                          {images.map((image) => {
                            const uri = image.url ?? image.storageKey;
                            if (!uri) return null;
                            return (
                              <View key={image.id} style={styles.portfolioImageWrap}>
                                <Image source={{ uri }} style={styles.portfolioImage} contentFit="cover" cachePolicy="memory-disk" />
                                {image.caption ? (
                                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={2}>
                                    {image.caption}
                                  </Text>
                                ) : null}
                              </View>
                            );
                          })}
                        </ScrollView>
                      ) : null}
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}
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

function SummaryStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summaryStat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{label}</Text>
      <Text style={[typography.bodyStrong, { color: colors.primaryDark }]}>{value}</Text>
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
  offeringFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  attributes: { gap: spacing.xs },
  attributeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summaryStat: { flex: 1, minWidth: 72, borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs },
  summaryRows: { gap: spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  portfolioImages: { gap: spacing.sm },
  portfolioImageWrap: { width: 140, gap: spacing.xs },
  portfolioImage: { width: 140, height: 110, borderRadius: radius.sm },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1 },
  favoriteButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
  pressed: { opacity: 0.72 },
});
