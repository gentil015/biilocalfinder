import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import { RefreshCw, Send } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { z } from 'zod';
import { Badge } from '@/src/components/ui/Badges';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { FormInput } from '@/src/components/ui/FormInput';
import { IconButton } from '@/src/components/ui/IconButton';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { queryKeys, useQuotes, useRequest } from '@/src/hooks/queries';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius as radiusTokens } from '@/src/theme/metrics';
import { formatDate, formatMoney, formatTime, humanize, statusLabel } from '@/src/utils/format';
import { quoteFormSchema } from '@/src/utils/validation';
import type { QuoteItem, QuoteStatus } from '@/src/types/api';

type Values = z.infer<typeof quoteFormSchema>;
type NoticeState = { message: string; tone: NoticeTone } | null;
type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

function requestTone(status: string): Tone {
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  if (status === 'ACCEPTED' || status === 'BOOKED') return 'success';
  if (status === 'QUOTED' || status === 'NEGOTIATING') return 'accent';
  return status === 'OPEN' ? 'warning' : 'neutral';
}

function quoteTone(status: QuoteStatus | string): Tone {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'PENDING') return 'accent';
  if (status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  return 'neutral';
}

function formatBudget(min?: number | null, max?: number | null): string {
  if (min === null && max === null) return 'Not specified';
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    return `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  const value = max ?? min;
  return value === null || value === undefined ? 'Not specified' : formatMoney(value);
}

function formatAttributeValue(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (Array.isArray(value)) return value.map(formatAttributeValue).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ProviderRequestDetailScreen() {
  const { id, price, estimatedDuration, description } = useLocalSearchParams<{
    id: string;
    price?: string;
    estimatedDuration?: string;
    description?: string;
  }>();
  const queryClient = useQueryClient();
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const [showQuote, setShowQuote] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const hydratedQuoteRef = useRef<string | null>(null);
  const request = useRequest(id);
  const quotes = useQuotes(id);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { requestId: id ?? '', price: '', estimatedDuration: '', description: '', materials: '' },
  });

  useEffect(() => {
    if (!id || !request.data || hydratedQuoteRef.current === id) return;
    const parsedPrice = typeof price === 'string' && price.trim() !== '' && Number.isFinite(Number(price)) ? price : '';
    reset({
      requestId: id,
      price: parsedPrice,
      estimatedDuration: typeof estimatedDuration === 'string' ? estimatedDuration : '',
      description: typeof description === 'string' ? description : '',
      materials: '',
    });
    hydratedQuoteRef.current = id;
  }, [id, price, estimatedDuration, description, reset]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.request(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.incomingRequests }),
    ]);
  };
  const createQuote = useMutation({
    mutationFn: (values: Values) =>
      requestsApi.createQuote({
        requestId: values.requestId,
        price: Number(values.price),
        estimatedDuration: values.estimatedDuration || undefined,
        description: values.description || undefined,
        materials: values.materials || undefined,
      }),
    onSuccess: async () => {
      await invalidate();
      setShowQuote(false);
      reset({ requestId: id ?? '', price: '', estimatedDuration: '', description: '', materials: '' });
      setNotice({ message: 'Quote sent to the client.', tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const revisionResponse = useMutation({
    mutationFn: ({ revisionId, action }: { revisionId: string; action: 'accept' | 'reject' }) =>
      action === 'accept' ? requestsApi.acceptRevision(revisionId) : requestsApi.rejectRevision(revisionId),
    onSuccess: async (_result, variables) => {
      await invalidate();
      setNotice({
        message: variables.action === 'accept' ? 'Counter-offer accepted. Your quote was updated.' : 'Counter-offer declined.',
        tone: 'success',
      });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  if (!id) {
    return (
      <Screen>
        <ErrorState title="Request not found" message="This request could not be identified." />
      </Screen>
    );
  }
  if (request.isPending) {
    return (
      <Screen>
        <AppScreenHeader title="Request detail" eyebrow="Loading" />
        <ListSkeleton rows={2} />
      </Screen>
    );
  }
  if (request.isError || !request.data) {
    return (
      <Screen>
        <AppScreenHeader title="Request detail" eyebrow="Incoming work" />
        <ErrorState message="Request not found." onRetry={() => void request.refetch()} />
      </Screen>
    );
  }

  const data = request.data;
  const clientName = [data.client?.firstName, data.client?.lastName].filter(Boolean).join(' ') || 'Client';
  const canQuote = ['OPEN', 'QUOTED', 'NEGOTIATING'].includes(data.status);
  const images = requestImages(data.images);
  const snapshots = (data.attributeSnapshots ?? []) as Array<{
    name?: string;
    label?: string;
    value?: unknown;
    attributeName?: string;
    attributeValue?: unknown;
  }>;
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}>
      <AppScreenHeader
        eyebrow="Incoming work"
        title="Request detail"
        subtitle={data.service?.name ?? humanize(String(data.serviceId))}
        action={
          <IconButton
            icon={<RefreshCw size={19} />}
            label="Refresh request"
            size={hit.min}
            disabled={request.isFetching || quotes.isFetching}
            onPress={() => void Promise.all([request.refetch(), quotes.refetch()])}
          />
        }
      />

      <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text style={[typography.h2, { color: colors.text, flex: 1 }]}>{data.title}</Text>
          <Badge label={statusLabel.request(data.status)} tone={requestTone(data.status)} />
        </View>
        {data.description ? <Text style={[typography.body, { color: colors.textSecondary }]}>{data.description}</Text> : null}
        <View style={styles.meta}>
          <DetailRow label="Preferred" value={`${formatDate(data.preferredDate)}${data.preferredTime ? ` · ${formatTime(data.preferredTime)}` : ''}`} />
          <DetailRow label="Budget" value={formatBudget(data.budgetMin, data.budgetMax)} />
          <DetailRow label="Client" value={clientName} />
          {data.service?.name ? <DetailRow label="Service" value={data.service.name} /> : null}
          {data.assignedTo ? <DetailRow label="Assigned to" value={[data.assignedTo.firstName, data.assignedTo.lastName].filter(Boolean).join(' ')} /> : null}
          {Array.isArray(data.images) && data.images.length ? <DetailRow label="Images" value={`${data.images.length} attached`} /> : null}
          <DetailRow label="Received" value={formatDate(data.createdAt)} />
        </View>
        {data.additionalNotes ? (
          <View style={[styles.notes, { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.md }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Additional notes</Text>
            <Text style={[typography.small, { color: colors.textSecondary }]}>{data.additionalNotes}</Text>
          </View>
        ) : null}
      </Card>

      {data.serviceOffering ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            {data.serviceOffering.title ?? data.service?.name ?? 'Selected offering'}
          </Text>
          {data.serviceOffering.description ? (
            <Text style={[typography.small, { color: colors.textSecondary }]}>{data.serviceOffering.description}</Text>
          ) : null}
          <View style={styles.meta}>
            {data.serviceOffering.basePrice != null ? (
              <DetailRow label="Offering price" value={formatMoney(data.serviceOffering.basePrice)} />
            ) : null}
            {data.serviceOffering.priceType ? <DetailRow label="Price type" value={data.serviceOffering.priceType} /> : null}
            {data.serviceOffering.duration != null ? (
              <DetailRow label="Duration" value={String(data.serviceOffering.duration)} />
            ) : null}
          </View>
        </Card>
      ) : null}

      {data.location ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <DetailRow label="Location" value={data.location.label ?? data.location.city ?? 'Selected location'} />
          {data.location.label && data.location.city ? <DetailRow label="City" value={data.location.city} /> : null}
        </Card>
      ) : null}

      {snapshots.length ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Service details</Text>
          <View style={styles.meta}>
            {snapshots.map((snapshot, index) => (
              <DetailRow
                key={`${snapshot.name ?? snapshot.label ?? snapshot.attributeName ?? 'attribute'}-${index}`}
                label={snapshot.label ?? snapshot.name ?? snapshot.attributeName ?? 'Attribute'}
                value={formatAttributeValue(snapshot.value ?? snapshot.attributeValue)}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {images.length ? (
        <Card variant="elevated" style={[cardStyle, elevation.subtle]}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>Photos ({images.length})</Text>
          {images.some((image) => image.uri) ? (
            <View style={styles.requestImages}>
              {images.filter((image) => image.uri).map((image, index) => (
                <ExpoImage key={`${image.label}-${index}`} source={{ uri: image.uri! }} style={styles.requestImage} contentFit="cover" />
              ))}
            </View>
          ) : null}
          {images.map((image, index) => (
            <Text key={`${image.label}-${index}`} style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {image.label}
            </Text>
          ))}
        </Card>
      ) : null}

      {notice ? <Notice message={notice.message} tone={notice.tone} /> : null}

      {canQuote ? (
        <Button
          label={showQuote ? 'Close quote form' : 'Send a quote'}
          variant={showQuote ? 'secondary' : 'primary'}
          icon={<Send size={16} color={showQuote ? colors.primaryDark : colors.white} />}
          onPress={() => {
            setNotice(null);
            setShowQuote((value) => !value);
          }}
          fullWidth
        />
      ) : null}

      <BottomSheet
        visible={showQuote && canQuote}
        title="Your quote"
        onClose={() => setShowQuote(false)}
        footer={<Button label="Submit quote" onPress={handleSubmit((values) => createQuote.mutate(values))} loading={createQuote.isPending} fullWidth />}
      >
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.small, { color: colors.textMuted }]}>For: {data.title}</Text>
          <FormInput label="Price" control={control} name="price" error={errors.price?.message} keyboardType="numeric" />
          <FormInput label="Estimated duration" control={control} name="estimatedDuration" error={errors.estimatedDuration?.message} placeholder="e.g. 3 hours" />
          <FormInput label="Description" control={control} name="description" error={errors.description?.message} multiline numberOfLines={3} />
          <FormInput label="Materials" control={control} name="materials" error={errors.materials?.message} multiline numberOfLines={2} />
        </View>
      </BottomSheet>

      <View>
        <SectionHeader title="Your quotes" subtitle={quotes.data ? `${quotes.data.length} submitted` : undefined} />
        {quotes.isLoading ? (
          <LoadingState label="Loading quotes…" />
        ) : quotes.isError ? (
          <ErrorState message="Quotes could not be loaded." onRetry={() => void quotes.refetch()} />
        ) : quotes.data?.length ? (
          <View style={{ gap: spacing.sm }}>
            {quotes.data.map((quote) => (
              <QuoteEntry
                key={quote.id}
                quote={quote}
                cardStyle={cardStyle}
                response={revisionResponse.isPending ? revisionResponse.variables : undefined}
                onRespond={(revisionId, action) => revisionResponse.mutate({ revisionId, action })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No quotes yet" message="Quotes you submit for this request will appear here." />
        )}
      </View>
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.small, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function QuoteEntry({
  quote,
  cardStyle,
  response,
  onRespond,
}: {
  quote: QuoteItem;
  cardStyle: StyleProp<ViewStyle>;
  response?: { revisionId: string; action: 'accept' | 'reject' };
  onRespond: (revisionId: string, action: 'accept' | 'reject') => void;
}) {
  const { colors, spacing, radius, typography, borderWidth } = useTheme();
  const revisionStyle = {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.sm,
    padding: spacing.sm,
  };
  const pendingRevision = quote.revisions?.find((revision) => revision.status === 'PENDING');
  const earlierRevisions = quote.revisions?.filter((revision) => revision.id !== pendingRevision?.id) ?? [];
  const needsProviderResponse = pendingRevision?.proposedBy === 'CLIENT';
  return (
    <Card variant="elevated" style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>Quote</Text>
        <Badge label={statusLabel.quote(quote.status)} tone={quoteTone(quote.status)} />
      </View>
      <Text style={[typography.h2, { color: colors.primaryDark }]}>{formatMoney(quote.price, quote.currency)}</Text>
      <View style={{ gap: 2 }}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Sent {formatDate(quote.createdAt)}</Text>
        {quote.estimatedDuration ? <Text style={[typography.caption, { color: colors.textMuted }]}>{String(quote.estimatedDuration)}</Text> : null}
        {quote.proposedDate ? <Text style={[typography.caption, { color: colors.textMuted }]}>Proposed: {formatDate(quote.proposedDate)}</Text> : null}
      </View>
      {quote.description ? <Text style={[typography.small, { color: colors.textSecondary }]}>{quote.description}</Text> : null}
      {quote.materials ? <Text style={[typography.small, { color: colors.textSecondary }]}>Materials: {quote.materials}</Text> : null}
      {quote.includedItems?.length ? <Text style={[typography.caption, { color: colors.textMuted }]}>Included: {quote.includedItems.join(', ')}</Text> : null}
      {quote.excludedItems?.length ? <Text style={[typography.caption, { color: colors.textMuted }]}>Excluded: {quote.excludedItems.join(', ')}</Text> : null}
      {pendingRevision ? (
        <View style={[revisionStyle, { gap: spacing.xs }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text, flexShrink: 1 }]}>
              {needsProviderResponse ? 'Client counter-offer' : 'Your counter-offer'}
            </Text>
            <Badge label={formatMoney(pendingRevision.price)} tone="accent" />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(pendingRevision.createdAt)}</Text>
          {pendingRevision.proposedDate ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Proposed: {formatDate(pendingRevision.proposedDate)}</Text>
          ) : null}
          {pendingRevision.estimatedDuration ? (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Duration: {pendingRevision.estimatedDuration}</Text>
          ) : null}
          {pendingRevision.message ? <Text style={[typography.small, { color: colors.textSecondary }]}>{pendingRevision.message}</Text> : null}
          {needsProviderResponse ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <Button
                label="Accept"
                size="sm"
                style={{ flex: 1 }}
                disabled={Boolean(response)}
                loading={response?.revisionId === pendingRevision.id && response.action === 'accept'}
                onPress={() => onRespond(pendingRevision.id, 'accept')}
              />
              <Button
                label="Decline"
                size="sm"
                variant="secondary"
                style={{ flex: 1 }}
                disabled={Boolean(response)}
                loading={response?.revisionId === pendingRevision.id && response.action === 'reject'}
                onPress={() => onRespond(pendingRevision.id, 'reject')}
              />
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>Waiting for the client to respond.</Text>
          )}
        </View>
      ) : null}
      {earlierRevisions.length ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>{earlierRevisions.length} earlier revision(s)</Text>
          {earlierRevisions.map((revision) => (
            <View key={revision.id} style={revisionStyle}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={[typography.bodyStrong, { color: colors.text }]}>{formatMoney(revision.price)}</Text>
                <Badge label={humanize(revision.status)} tone={quoteTone(revision.status)} />
              </View>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(revision.createdAt)}</Text>
              {revision.message ? <Text style={[typography.small, { color: colors.textSecondary }]}>{revision.message}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function requestImages(value: unknown): Array<{ uri?: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string' && item) {
      return [{ uri: /^https?:\/\//.test(item) ? item : undefined, label: item }];
    }
    if (item && typeof item === 'object') {
      const raw = item as { url?: string | null; storageKey?: string | null };
      const label = raw.url ?? raw.storageKey;
      if (!label) return [];
      return [{ uri: /^https?:\/\//.test(label) ? label : undefined, label }];
    }
    return [];
  });
}

const styles = StyleSheet.create({
  meta: { gap: 6 },
  notes: { gap: 4 },
  requestImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  requestImage: { width: 72, height: 72, borderRadius: radiusTokens.sm },
});
