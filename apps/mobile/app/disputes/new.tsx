import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileWarning } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Chip } from '@/src/components/ui/Chip';
import { Input } from '@/src/components/ui/Input';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys } from '@/src/hooks/queries';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import {
  DISPUTE_CATEGORIES,
  parityCustomerApi,
  type DisputeCategory,
} from '@/src/services/api/endpoints/parity-customer';
import { toApiError } from '@/src/services/api/errors';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing } from '@/src/theme/metrics';
import { humanize } from '@/src/utils/format';

export default function NewDisputeScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors } = useTheme();
  const [bookingId, setBookingId] = useState(typeof params.bookingId === 'string' ? params.bookingId : '');
  const [category, setCategory] = useState<DisputeCategory>(DISPUTE_CATEGORIES[0]);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const bookings = useQuery({ queryKey: queryKeys.bookings(false), queryFn: () => requestsApi.myBookings() });

  const create = useMutation({
    mutationFn: () =>
      parityCustomerApi.createDispute({
        bookingId: bookingId.trim(),
        category,
        reason: reason.trim(),
        details: details.trim() || undefined,
      }),
    onSuccess: async (dispute) => {
      await queryClient.invalidateQueries({ queryKey: ['disputes'] });
      showToast('Dispute opened.', 'success');
      router.push({ pathname: '/disputes/[id]', params: { id: dispute.id } });
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const submit = () => {
    if (!bookingId.trim()) {
      setNotice({ message: 'Choose the booking this dispute is about.', tone: 'error' });
      return;
    }
    if (reason.trim().length < 5 || reason.trim().length > 200) {
      setNotice({ message: 'The reason must be between 5 and 200 characters.', tone: 'error' });
      return;
    }
    setNotice(null);
    create.mutate();
  };

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader title="Report a problem" eyebrow="New dispute" subtitle="We will connect both sides in one thread" />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      <Card>
        <SectionHeader title="Booking" subtitle="Select one of your bookings or paste its ID." />
        {bookings.isError ? (
          <ErrorState message="Bookings could not be loaded." onRetry={() => void bookings.refetch()} />
        ) : bookings.isPending ? (
          <Skeleton height={40} />
        ) : bookings.data?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
            {bookings.data.map((booking) => (
              <Chip
                key={booking.id}
                label={booking.request?.title ?? humanize(booking.status)}
                selected={bookingId === booking.id}
                onPress={() => setBookingId(booking.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptyState title="No bookings found" message="Enter the booking ID from your booking details below." />
        )}
        <Input label="Booking ID" value={bookingId} onChangeText={setBookingId} placeholder="Booking UUID" autoCapitalize="none" />
      </Card>

      <Card>
        <SectionHeader title="Category" subtitle="Pick the closest match so the right reviewer sees it." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DISPUTE_CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={humanize(option)}
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
        <Input
          label="What happened?"
          value={reason}
          onChangeText={setReason}
          placeholder="Short summary"
          hint={`${reason.length}/200 characters, at least 5`}
        />
        <Input
          label="Details (optional)"
          value={details}
          onChangeText={setDetails}
          placeholder="Dates, amounts, what was agreed, and what happened instead"
          multiline
          numberOfLines={5}
        />
        {bookingId ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Badge label="Booking selected" tone="success" />
            <Badge label={category ? humanize(category) : 'Category'} />
          </View>
        ) : null}
        <Button
          label="Open dispute"
          icon={<FileWarning size={16} color={colors.textOnPrimary} />}
          onPress={submit}
          loading={create.isPending}
          fullWidth
        />
      </Card>
    </Screen>
  );
}
