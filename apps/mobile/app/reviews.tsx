import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquareReply, Star } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ReviewCard } from '@/src/components/domain/ReviewCard';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { queryKeys, useInboxReviews } from '@/src/hooks/queries';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { toApiError } from '@/src/services/api/errors';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';

export default function ReviewsScreen() {
  const { ready } = useRoleGuard(['PROVIDER']);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const reviews = useInboxReviews();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);

  const respond = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => providerApi.respondToReview(id, text),
    onSuccess: async (_review, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.inboxReviews });
      setResponses((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      setNotice({ message: 'Response published.', tone: 'success' });
      showToast('Response published.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Reviews"
        eyebrow="Reputation"
        subtitle={reviews.data?.unanswered ? `${reviews.data.unanswered} waiting for a response` : 'Client feedback on completed bookings'}
        action={
          reviews.data?.unanswered ? (
            <Badge label={`${reviews.data.unanswered} to answer`} tone="warning" />
          ) : undefined
        }
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />
      {reviews.isError ? (
        <ErrorState message="Reviews could not be loaded." onRetry={() => void reviews.refetch()} />
      ) : reviews.isPending ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={160} />
          <Skeleton height={160} />
        </View>
      ) : reviews.data?.items.length ? (
        <View style={{ gap: spacing.lg }}>
          <SectionHeader title="Latest reviews" subtitle="Public responses appear under the client review." />
          {reviews.data.items.map((review) => (
            <View key={review.id} style={{ gap: spacing.sm }}>
              <ReviewCard review={review} />
              {!review.response ? (
                <Card>
                  <Input
                    label="Public response"
                    value={responses[review.id] ?? ''}
                    onChangeText={(text) => setResponses((current) => ({ ...current, [review.id]: text }))}
                    placeholder="Thank the client and add context"
                    multiline
                    numberOfLines={3}
                  />
                  <Button
                    label="Publish response"
                    size="sm"
                    icon={<MessageSquareReply size={14} color={colors.textOnPrimary} />}
                    loading={respond.isPending && respond.variables?.id === review.id}
                    disabled={!responses[review.id]?.trim()}
                    onPress={() => {
                      const text = responses[review.id]?.trim();
                      if (!text) return;
                      setNotice(null);
                      respond.mutate({ id: review.id, text });
                    }}
                  />
                </Card>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Star size={24} color={colors.primary} />}
          title="No reviews yet"
          message="Completed bookings can be reviewed by clients."
        />
      )}
    </Screen>
  );
}
