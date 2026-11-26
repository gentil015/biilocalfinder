import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image as ExpoImage } from 'expo-image';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { QuoteCard } from '@/src/components/domain/QuoteCard';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { ConfirmDialog } from '@/src/components/ui/ConfirmDialog';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { queryKeys, useQuotes, useRequest } from '@/src/hooks/queries';
import { messagingApi } from '@/src/services/api/endpoints/messaging';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { radius, spacing, typography } from '@/src/theme/metrics';
import { formatDate, formatMoney, statusLabel } from '@/src/utils/format';

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const [revisionPrices, setRevisionPrices] = useState<Record<string, string>>({});
  const [revisionMessages, setRevisionMessages] = useState<Record<string, string>>({});
  const [expandedCounter, setExpandedCounter] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<{ quoteId: string; action: 'accept' | 'reject' } | null>(null);
  const request = useRequest(id);
  const quotes = useQuotes(id);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.request(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.quotes(id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myRequests }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
    ]);
  };

  const quoteAction = useMutation({
    mutationFn: async ({ quoteId, action }: { quoteId: string; action: 'accept' | 'reject' }) => {
      if (action === 'accept') return requestsApi.acceptQuote(quoteId);
      return requestsApi.rejectQuote(quoteId);
    },
    onMutate: (vars) => setPendingQuoteAction(vars),
    onSettled: () => setPendingQuoteAction(null),
    onSuccess: async (result, variables) => {
      await invalidate();
      if (variables.action === 'accept') {
        if (result && 'id' in result) router.push({ pathname: '/booking/[id]', params: { id: String(result.id) } });
      } else {
        setNotice({ message: 'Quote declined.', tone: 'success' });
      }
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const revision = useMutation({
    mutationFn: ({ quoteId, price, message }: { quoteId: string; price: number; message?: string }) =>
      requestsApi.createRevision(quoteId, price, message),
    onSuccess: async () => {
      await invalidate();
      setNotice({ message: 'Counter-offer sent.', tone: 'success' });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const revisionAction = useMutation({
    mutationFn: ({ id: revisionId, action }: { id: string; action: 'accept' | 'reject' }) =>
      action === 'accept' ? requestsApi.acceptRevision(revisionId) : requestsApi.rejectRevision(revisionId),
    onSuccess: invalidate,
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const cancel = useMutation({
    mutationFn: () => requestsApi.cancel(id!),
    onSuccess: async () => {
      await invalidate();
      router.back();
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const message = useMutation({
    mutationFn: () => messagingApi.createConversation(request.data!.providerId!),
    onSuccess: (conversation) => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } }),
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  if (request.isLoading) return <Screen><AppScreenHeader title="Request" /><Text style={[typography.body, { color: colors.textMuted }]}>Loading request…</Text></Screen>;
  if (request.isError || !request.data) {
    return <Screen><AppScreenHeader title="Request" /><ErrorState message="Request not found." onRetry={() => void request.refetch()} /></Screen>;
  }

  const data = request.data;
  const images = requestImages(data.images);
  const snapshots = (data.attributeSnapshots ?? []) as Array<{
    name?: string;
    label?: string;
    value?: unknown;
    attributeName?: string;
    attributeValue?: unknown;
  }>;
  const canCancel = !['CANCELLED', 'BOOKED', 'EXPIRED'].includes(data.status);
  return (
    <Screen>
      <AppScreenHeader title="Request details" subtitle={data.service?.name ?? 'Service request'} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Text style={[typography.h2, { color: colors.text, flex: 1 }]}>{data.title}</Text>
          <Badge label={statusLabel.request(data.status)} tone={data.status === 'CANCELLED' ? 'danger' : data.status === 'BOOKED' ? 'success' : 'accent'} />
        </View>
        <Notice message={notice?.message ?? null} tone={notice?.tone} />
        <Card variant="muted">
          <Text style={[typography.body, { color: colors.textSecondary }]}>{data.description}</Text>
          <View style={styles.details}>
            <Detail label="Preferred date" value={`${formatDate(data.preferredDate)} ${data.preferredTime ?? ''}`.trim()} />
            <Detail label="Budget" value={formatMoney(data.budgetMax ?? data.budgetMin)} />
            <Detail label="Visibility" value={data.isPublic ? 'Public' : 'Private'} />
          </View>
        </Card>

        {data.serviceOffering ? (
          <Card variant="muted" style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>{data.serviceOffering.title ?? data.service?.name ?? 'Selected offering'}</Text>
            {data.serviceOffering.description ? <Text style={[typography.small, { color: colors.textSecondary }]}>{data.serviceOffering.description}</Text> : null}
            <View style={styles.details}>
              {data.serviceOffering.basePrice != null ? <Detail label="Offering price" value={formatMoney(data.serviceOffering.basePrice)} /> : null}
              {data.serviceOffering.priceType ? <Detail label="Price type" value={data.serviceOffering.priceType} /> : null}
              {data.serviceOffering.duration != null ? <Detail label="Duration" value={String(data.serviceOffering.duration)} /> : null}
            </View>
          </Card>
        ) : null}

        {data.location ? (
          <Card variant="muted">
            <View style={styles.details}>
              <Detail label="Location" value={data.location.label ?? data.location.city ?? 'Selected location'} />
              {data.location.label && data.location.city ? <Detail label="City" value={data.location.city} /> : null}
            </View>
          </Card>
        ) : null}

        {snapshots.length ? (
          <Card variant="muted" style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Service details</Text>
            {snapshots.map((snapshot, index) => (
              <Detail
                key={`${snapshot.name ?? snapshot.label ?? snapshot.attributeName ?? 'attribute'}-${index}`}
                label={snapshot.label ?? snapshot.name ?? snapshot.attributeName ?? 'Attribute'}
                value={attributeValueText(snapshot.value ?? snapshot.attributeValue)}
              />
            ))}
          </Card>
        ) : null}

        {images.length ? (
          <Card variant="muted" style={{ gap: spacing.sm }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Photos ({images.length})</Text>
            {images.some((image) => image.uri) ? (
              <View style={styles.imageRow}>
                {images.filter((image) => image.uri).map((image, index) => (
                  <ExpoImage key={`${image.label}-${index}`} source={{ uri: image.uri! }} style={styles.image} contentFit="cover" />
                ))}
              </View>
            ) : null}
            {images.map((image, index) => (
              <Text key={`${image.label}-${index}`} style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>{image.label}</Text>
            ))}
          </Card>
        ) : null}

        {data.additionalNotes ? (
          <Card variant="muted" style={{ gap: spacing.xs }}>
            <Text style={[typography.bodyStrong, { color: colors.text }]}>Additional notes</Text>
            <Text style={[typography.small, { color: colors.textSecondary }]}>{data.additionalNotes}</Text>
          </Card>
        ) : null}

        {data.booking ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.details}>
              <Detail label="Booking" value={statusLabel.booking(data.booking.status)} />
              <Detail label="Scheduled" value={formatDate(data.booking.scheduledAt ?? data.booking.createdAt)} />
              <Detail label="Agreed price" value={formatMoney(data.booking.agreedPrice, data.booking.currency)} />
            </View>
            <Button label="View booking" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/booking/[id]', params: { id: data.booking!.id } })} />
          </Card>
        ) : null}

        {data.providerId ? (
          <Button label="Message provider" variant="secondary" icon={<MessageCircle size={16} />} loading={message.isPending} onPress={() => message.mutate()} />
        ) : null}

        <View>
          <SectionHeader title={`Quotes (${quotes.data?.length ?? 0})`} subtitle="Compare offers and respond" />
          {quotes.data?.length ? (
            <View style={{ gap: spacing.md }}>
              {quotes.data.map((quote) => {
                const pendingRevision = quote.revisions?.find((item) => item.status === 'PENDING');
                const isAccepting = quoteAction.isPending && pendingQuoteAction?.quoteId === quote.id && pendingQuoteAction.action === 'accept';
                const isRejecting = quoteAction.isPending && pendingQuoteAction?.quoteId === quote.id && pendingQuoteAction.action === 'reject';
                const counterOpen = expandedCounter === quote.id;
                return (
                  <View key={quote.id} style={styles.quoteBlock}>
                    <QuoteCard
                      quote={quote}
                      showActions={data.status === 'OPEN' || data.status === 'QUOTED'}
                      accepting={isAccepting}
                      rejecting={isRejecting}
                      onAccept={() => quoteAction.mutate({ quoteId: quote.id, action: 'accept' })}
                      onReject={() => quoteAction.mutate({ quoteId: quote.id, action: 'reject' })}
                    />
                    {pendingRevision ? (
                      <Card variant="muted">
                        <View style={{ gap: spacing.sm }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>Pending counter-offer</Text>
                            <Badge label={formatMoney(pendingRevision.price)} tone="accent" />
                          </View>
                          {pendingRevision.message ? <Text style={[typography.caption, { color: colors.textMuted }]}>{pendingRevision.message}</Text> : null}
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            <Button label="Accept" size="sm" loading={revisionAction.isPending} onPress={() => revisionAction.mutate({ id: pendingRevision.id, action: 'accept' })} />
                            <Button label="Reject" size="sm" variant="secondary" onPress={() => revisionAction.mutate({ id: pendingRevision.id, action: 'reject' })} />
                          </View>
                        </View>
                      </Card>
                    ) : (data.status === 'OPEN' || data.status === 'QUOTED' || data.status === 'NEGOTIATING') ? (
                      <Card variant="muted">
                        <Pressable accessibilityRole="button" onPress={() => setExpandedCounter(counterOpen ? null : quote.id)} style={styles.counterHeader}>
                          <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]}>Counter-offer</Text>
                          {counterOpen ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
                        </Pressable>
                        {counterOpen ? (
                          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                            <Input label="New price (RWF)" value={revisionPrices[quote.id] ?? ''} onChangeText={(text) => setRevisionPrices((c) => ({ ...c, [quote.id]: text }))} keyboardType="numeric" placeholder={String(quote.price)} />
                            <Input label="Message" value={revisionMessages[quote.id] ?? ''} onChangeText={(text) => setRevisionMessages((c) => ({ ...c, [quote.id]: text }))} placeholder="Explain your counter-offer" />
                            <Button
                              label="Send counter-offer"
                              size="sm"
                              disabled={!revisionPrices[quote.id]}
                              loading={revision.isPending && revision.variables?.quoteId === quote.id}
                              onPress={() => revision.mutate({ quoteId: quote.id, price: Number(revisionPrices[quote.id]), message: revisionMessages[quote.id] || undefined })}
                            />
                          </View>
                        ) : null}
                      </Card>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : quotes.isError ? (
            <ErrorState message="Quotes could not be loaded." onRetry={() => void quotes.refetch()} />
          ) : quotes.isLoading ? (
            <Text style={[typography.small, { color: colors.textMuted }]}>Loading quotes…</Text>
          ) : (
            <EmptyState title="No quotes yet" message="Professionals will send quotes for your request here." />
          )}
        </View>

        {canCancel ? <Button label="Cancel request" variant="danger" onPress={() => setConfirmCancel(true)} /> : null}
      </ScrollView>
      <ConfirmDialog
        visible={confirmCancel}
        title="Cancel request?"
        message="This will stop providers from sending new quotes for this request."
        confirmLabel="Cancel request"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setConfirmCancel(false)}
      />
    </Screen>
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

function attributeValueText(value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (Array.isArray(value)) return value.map(attributeValueText).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.detail}>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[typography.small, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  quoteBlock: { gap: spacing.sm },
  details: { gap: spacing.sm, marginTop: spacing.md },
  detail: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
  counterHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  image: { width: 72, height: 72, borderRadius: radius.sm },
});
