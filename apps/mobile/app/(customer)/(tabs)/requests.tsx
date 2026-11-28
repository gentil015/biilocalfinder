import { Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BookingCard } from '@/src/components/domain/BookingCard';
import { RequestCard } from '@/src/components/domain/RequestCard';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Button } from '@/src/components/ui/Button';
import { IconButton } from '@/src/components/ui/IconButton';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { SectionHeader } from '@/src/components/ui/Card';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useBookings, useMyRequests } from '@/src/hooks/queries';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';

const NEEDS_ACTION_REQUEST = new Set(['QUOTED', 'NEGOTIATING']);
const ACTIVE_REQUEST = new Set(['OPEN', 'QUOTED', 'NEGOTIATING', 'ACCEPTED', 'BOOKED']);
const WAITING_BOOKING = new Set(['ACCEPTED']);
const ACTIVE_BOOKING = new Set(['REQUESTED', 'QUOTED', 'NEGOTIATING', 'ACCEPTED', 'CONFIRMED', 'IN_PROGRESS']);

export default function CustomerRequestsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'requests' | 'bookings'>('requests');
  const requests = useMyRequests();
  const bookings = useBookings(false);
  const active = tab === 'requests' ? requests : bookings;

  const requestGroups = useMemo(() => {
    const items = requests.data ?? [];
    return {
      needsAction: items.filter((r) => NEEDS_ACTION_REQUEST.has(r.status)),
      upcoming: items.filter((r) => r.status === 'OPEN' || r.status === 'ACCEPTED' || r.status === 'BOOKED'),
      history: items.filter((r) => !ACTIVE_REQUEST.has(r.status)),
    };
  }, [requests.data]);

  const bookingGroups = useMemo(() => {
    const items = bookings.data ?? [];
    return {
      waiting: items.filter((b) => WAITING_BOOKING.has(b.status)),
      upcoming: items.filter((b) => ACTIVE_BOOKING.has(b.status) && !WAITING_BOOKING.has(b.status)),
      history: items.filter((b) => !ACTIVE_BOOKING.has(b.status)),
    };
  }, [bookings.data]);

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={active.isFetching && !active.isLoading} onRefresh={() => void active.refetch()} tintColor={colors.primary} />}
      contentStyle={{ gap: spacing.lg }}
    >
      <AppScreenHeader
        title="My activity"
        subtitle="Track requests, quotes, and bookings"
        back={false}
        large
        action={<IconButton icon={<Plus size={20} />} label="New request" variant="primary" onPress={() => router.push('/request/new')} />}
      />

      <SegmentedControl
        options={[
          { label: 'Requests', value: 'requests', count: requests.data?.length },
          { label: 'Bookings', value: 'bookings', count: bookings.data?.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {active.isError ? (
        <ErrorState message="Could not load your activity." onRetry={() => void active.refetch()} />
      ) : tab === 'requests' ? (
        requests.isLoading ? (
          <ListSkeleton rows={4} />
        ) : requests.data?.length ? (
          <View style={{ gap: spacing.xl }}>
            {requestGroups.needsAction.length ? (
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Needs action" subtitle="Quotes or responses waiting for you" />
                {requestGroups.needsAction.map((request) => (
                  <RequestCard key={request.id} request={request} onPress={() => router.push({ pathname: '/request/[id]', params: { id: request.id } })} />
                ))}
              </View>
            ) : null}
            {requestGroups.upcoming.length ? (
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="Active requests" />
                {requestGroups.upcoming.filter((r) => !NEEDS_ACTION_REQUEST.has(r.status)).map((request) => (
                  <RequestCard key={request.id} request={request} onPress={() => router.push({ pathname: '/request/[id]', params: { id: request.id } })} />
                ))}
              </View>
            ) : null}
            {requestGroups.history.length ? (
              <View style={{ gap: spacing.md }}>
                <SectionHeader title="History" />
                {requestGroups.history.map((request) => (
                  <RequestCard key={request.id} request={request} onPress={() => router.push({ pathname: '/request/[id]', params: { id: request.id } })} />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <EmptyState
            title="No requests yet"
            message="Find a professional and send your first service request."
            actionLabel="Browse providers"
            onAction={() => router.push('/explore')}
          />
        )
      ) : bookings.isLoading ? (
        <ListSkeleton rows={4} />
      ) : bookings.data?.length ? (
        <View style={{ gap: spacing.xl }}>
          {bookingGroups.waiting.length ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Waiting for provider" subtitle="Your quote was accepted. The provider will confirm the booking." />
              {bookingGroups.waiting.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })} />
              ))}
            </View>
          ) : null}
          {bookingGroups.upcoming.length ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="Upcoming & active" />
              {bookingGroups.upcoming.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })} />
              ))}
            </View>
          ) : null}
          {bookingGroups.history.length ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader title="History" />
              {bookingGroups.history.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })} />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <EmptyState title="No bookings yet" message="Accepted quotes become bookings here." actionLabel="Create request" onAction={() => router.push('/request/new')} />
      )}

      <Button label="Request a service" variant="secondary" onPress={() => router.push('/request/new')} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({});
