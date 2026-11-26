import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CalendarDays, Flag, ImagePlus, MessageCircle, Star, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { FormInput } from '@/src/components/ui/FormInput';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ErrorState } from '@/src/components/ui/States';
import { filesApi } from '@/src/services/api/endpoints/files';
import { messagingApi } from '@/src/services/api/endpoints/messaging';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { formatDate, formatMoney, statusLabel } from '@/src/utils/format';

const reviewSchema = z.object({
  rating: z.string().min(1, 'Choose a rating').refine((value) => Number(value) >= 1 && Number(value) <= 5, 'Choose a rating'),
  qualityRating: z.string().optional(),
  communicationRating: z.string().optional(),
  professionalismRating: z.string().optional(),
  valueRating: z.string().optional(),
  comment: z.string().max(2000).optional(),
});
type ReviewValues = z.infer<typeof reviewSchema>;

const TIMELINE: Array<{ status: string; label: string }> = [
  { status: 'REQUESTED', label: 'Requested' },
  { status: 'ACCEPTED', label: 'Accepted' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'COMPLETED', label: 'Completed' },
];

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${label} ${n} star${n === 1 ? '' : 's'}`} onPress={() => onChange(n)}>
            <Star size={28} color={n <= value ? colors.gold : colors.borderStrong} fill={n <= value ? colors.gold : 'transparent'} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewPhotos, setReviewPhotos] = useState<Array<{ storageKey: string; url: string; uploading?: boolean }>>([]);
  const booking = useQuery({ queryKey: ['booking', id], queryFn: () => requestsApi.booking(id!) });
  const reviewState = useQuery({ queryKey: ['booking-review', id], queryFn: () => requestsApi.bookingReview(id!) });
  const { control, handleSubmit, setValue, watch } = useForm<ReviewValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: '', qualityRating: '', communicationRating: '', professionalismRating: '', valueRating: '', comment: '' },
  });
  const ratingValue = Number(watch('rating') || 0);

  const uploadReviewPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (result.canceled) return;
    for (const asset of result.assets.slice(0, 5 - reviewPhotos.length)) {
      const temp = `${Date.now()}-${Math.random()}`;
      setReviewPhotos((c) => [...c, { storageKey: temp, url: asset.uri, uploading: true }]);
      try {
        const uploaded = await filesApi.uploadReviewPhoto(asset);
        setReviewPhotos((c) => c.map((p) => p.storageKey === temp ? { storageKey: uploaded.storageKey, url: uploaded.url } : p));
      } catch (error) {
        setReviewPhotos((c) => c.filter((p) => p.storageKey !== temp));
        setNotice(toApiError(error).message);
      }
    }
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => requestsApi.updateBookingStatus(id!, status),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['booking', id] }), queryClient.invalidateQueries({ queryKey: ['bookings'] })]);
      setNotice('Booking status updated.');
    },
    onError: (error) => setNotice(toApiError(error).message),
  });

  const messageMutation = useMutation({
    mutationFn: (providerId: string) => messagingApi.createConversation(providerId),
    onSuccess: (conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } }),
    onError: (error) => setNotice(toApiError(error).message),
  });

  const reviewMutation = useMutation({
    mutationFn: (values: ReviewValues) =>
      requestsApi.createReview(id!, {
        rating: Number(values.rating),
        qualityRating: values.qualityRating ? Number(values.qualityRating) : undefined,
        communicationRating: values.communicationRating ? Number(values.communicationRating) : undefined,
        professionalismRating: values.professionalismRating ? Number(values.professionalismRating) : undefined,
        valueRating: values.valueRating ? Number(values.valueRating) : undefined,
        comment: values.comment || undefined,
        photoKeys: reviewPhotos.length ? reviewPhotos.map((photo) => photo.storageKey) : undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['booking-review', id] });
      setNotice('Thank you for your review.');
    },
    onError: (error) => setNotice(toApiError(error).message),
  });

  if (booking.isLoading) return <Screen><AppScreenHeader title="Booking" /><Text style={[typography.body, { color: colors.textMuted }]}>Loading booking…</Text></Screen>;
  if (booking.isError || !booking.data) return <Screen><AppScreenHeader title="Booking" /><ErrorState message="Booking not found." onRetry={() => void booking.refetch()} /></Screen>;
  const data = booking.data;
  const isProvider = data.viewerRole === 'PROVIDER';
  const currentIdx = TIMELINE.findIndex((t) => t.status === data.status);
  const isCancelled = data.status === 'CANCELLED';
  return (
    <Screen>
      <AppScreenHeader title="Booking" subtitle={data.request?.title ?? 'Service booking'} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Text style={[typography.h2, { color: colors.text, flex: 1 }]}>{data.request?.title ?? 'Booking'}</Text>
          <Badge label={statusLabel.booking(data.status)} tone={data.status === 'CANCELLED' ? 'danger' : data.status === 'COMPLETED' ? 'success' : 'accent'} />
        </View>
        <Notice message={notice} tone={notice?.includes('updated') || notice?.includes('Thank') ? 'success' : notice ? 'error' : 'info'} />

        <Card variant="muted">
          <Text style={[typography.bodyStrong, { color: colors.text }]}>{isProvider ? data.client?.firstName ?? 'Client' : data.provider?.businessName ?? 'Provider'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <CalendarDays size={14} color={colors.textMuted} />
            <Text style={[typography.small, { color: colors.textMuted }]}>{formatDate(data.scheduledAt ?? data.createdAt)}</Text>
          </View>
          <Text style={[typography.h2, { color: colors.primaryDark, marginTop: spacing.sm }]}>{formatMoney(data.agreedPrice, data.currency)}</Text>
          {data.contact?.phone || data.contact?.email ? <Text style={[typography.small, { color: colors.textSecondary, marginTop: spacing.xs }]}>{data.contact.phone ?? data.contact.email}</Text> : null}
        </Card>

        <Card>
          <SectionHeader title="Status timeline" />
          <View style={{ gap: spacing.sm }}>
            {isCancelled ? (
              <View style={styles.timelineRow}><View style={[styles.dot, { backgroundColor: colors.danger }]} /><Text style={[typography.bodyStrong, { color: colors.danger }]}>Cancelled</Text></View>
            ) : TIMELINE.map((step, idx) => {
              const done = currentIdx >= idx;
              const active = currentIdx === idx;
              return (
                <View key={step.status} style={styles.timelineRow}>
                  <View style={[styles.dot, { backgroundColor: done ? colors.primary : colors.borderStrong, borderWidth: active ? 2 : 0, borderColor: colors.gold }]} />
                  <Text style={[typography.small, { color: done ? colors.text : colors.textMuted, fontWeight: active ? '700' : '400' }]}>{step.label}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {!isProvider && data.providerId ? (
            <Button label="Message provider" variant="secondary" icon={<MessageCircle size={16} />} loading={messageMutation.isPending} onPress={() => messageMutation.mutate(data.providerId!)} style={{ flex: 1 }} />
          ) : null}
          <Button label="Report issue" variant="ghost" icon={<Flag size={16} />} onPress={() => router.push({ pathname: '/disputes/new', params: { bookingId: data.id } })} style={{ flex: 1 }} />
        </View>

        {isProvider && ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'].includes(data.status) ? (
          <View>
            <SectionHeader title="Update status" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {data.status === 'ACCEPTED' ? <Button label="Confirm" size="sm" onPress={() => statusMutation.mutate('CONFIRMED')} loading={statusMutation.isPending} /> : null}
              {data.status === 'CONFIRMED' ? <Button label="Start work" size="sm" onPress={() => statusMutation.mutate('IN_PROGRESS')} loading={statusMutation.isPending} /> : null}
              {data.status === 'IN_PROGRESS' ? <Button label="Complete" size="sm" onPress={() => statusMutation.mutate('COMPLETED')} loading={statusMutation.isPending} /> : null}
              <Button label="Cancel" size="sm" variant="danger" onPress={() => statusMutation.mutate('CANCELLED')} loading={statusMutation.isPending} />
            </View>
          </View>
        ) : null}

        {!isProvider && reviewState.isError ? (
          <ErrorState message="Review status could not be loaded." onRetry={() => void reviewState.refetch()} />
        ) : !isProvider && data.status === 'COMPLETED' && reviewState.data?.canReview ? (
          <View style={{ gap: spacing.md }}>
            <SectionHeader title="Leave a review" subtitle="Your feedback helps other clients." />
            <Card style={{ gap: spacing.md }}>
              <StarInput label="Overall rating" value={ratingValue} onChange={(n) => setValue('rating', String(n), { shouldValidate: true })} />
              {!ratingValue ? <Text style={[typography.caption, { color: colors.textMuted }]}>Choose a rating before submitting.</Text> : null}
              <FormInput label="Comment" control={control} name="comment" multiline numberOfLines={4} placeholder="Share your experience" />
              <View style={styles.subratings}>
                {(['qualityRating', 'communicationRating', 'professionalismRating', 'valueRating'] as const).map((field) => (
                  <View key={field} style={{ width: '48%' }}>
                    <FormInput label={field.replace('Rating', '').replace(/^\w/, (c) => c.toUpperCase()) + ' (1-5)'} control={control} name={field} keyboardType="numeric" />
                  </View>
                ))}
              </View>
              <Pressable accessibilityRole="button" onPress={() => void uploadReviewPhotos()} style={[styles.upload, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
                <ImagePlus size={18} color={colors.primaryDark} />
                <Text style={[typography.small, { color: colors.primaryDark }]}>Add photos</Text>
              </Pressable>
              {reviewPhotos.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {reviewPhotos.map((photo, index) => (
                    <View key={`${photo.storageKey}-${index}`} style={styles.imageWrap}>
                      <ExpoImage source={{ uri: photo.url }} style={styles.image} contentFit="cover" />
                      {photo.uploading ? <View style={[styles.imageOverlay, { backgroundColor: colors.overlay }]}><Text style={[styles.overlayText, { color: colors.white }]}>…</Text></View> : null}
                      <Pressable accessibilityRole="button" accessibilityLabel="Remove review photo" onPress={() => setReviewPhotos((c) => c.filter((_, i) => i !== index))} style={[styles.remove, { backgroundColor: colors.danger }]}>
                        <X size={12} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Button
                label="Submit review"
                onPress={handleSubmit((values) => reviewMutation.mutate(values))}
                loading={reviewMutation.isPending}
                disabled={!ratingValue || reviewPhotos.some((p) => p.uploading)}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 48, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.md },
  imageWrap: { position: 'relative' },
  image: { width: 64, height: 64, borderRadius: radius.sm },
  imageOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  overlayText: { fontSize: 12, fontWeight: '700' },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  subratings: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
