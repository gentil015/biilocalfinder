import { useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { RequestCard } from '@/src/components/domain/RequestCard';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Card } from '@/src/components/ui/Card';
import { IconButton } from '@/src/components/ui/IconButton';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl, type SegmentOption } from '@/src/components/ui/SegmentedControl';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useIncomingRequests } from '@/src/hooks/queries';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { ServiceRequestStatus } from '@/src/types/api';

type Filter = ServiceRequestStatus | 'ALL';

const FILTERS: Array<{ label: string; value: Filter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Quoted', value: 'QUOTED' },
  { label: 'Booked', value: 'BOOKED' },
];

const emptyCopy: Record<Filter, { title: string; message: string }> = {
  ALL: { title: 'No incoming requests', message: 'New client requests will appear here.' },
  OPEN: { title: 'No open requests', message: 'Requests waiting for a quote will appear here.' },
  QUOTED: { title: 'No quoted requests', message: 'Requests you have quoted will appear here.' },
  BOOKED: { title: 'No booked requests', message: 'Requests that turned into bookings will appear here.' },
  NEGOTIATING: { title: 'No negotiations', message: 'Requests with counter-offers will appear here.' },
  ACCEPTED: { title: 'No accepted requests', message: 'Accepted requests will appear here.' },
  CANCELLED: { title: 'No cancelled requests', message: 'Cancelled requests will appear here.' },
  EXPIRED: { title: 'No expired requests', message: 'Expired requests will appear here.' },
};

export default function ProviderRequestsScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography, borderWidth, elevation, hit, layout } = useTheme();
  const [filter, setFilter] = useState<Filter>('ALL');
  const requests = useIncomingRequests();
  const all = requests.data ?? [];
  const items = all.filter((request) => filter === 'ALL' || request.status === filter);
  const options: SegmentOption<Filter>[] = FILTERS.map((option) => ({
    ...option,
    count: option.value === 'ALL' ? all.length : all.filter((request) => request.status === option.value).length,
  }));

  return (
    <Screen
      refreshControl={<RefreshControl refreshing={requests.isFetching} onRefresh={() => void requests.refetch()} tintColor={colors.primary} />}
      contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}
    >
      <AppScreenHeader
        eyebrow="Incoming work"
        title="Requests"
        subtitle="Review jobs and send competitive quotes"
        back={false}
        large
        action={
          <IconButton
            icon={<RefreshCw size={19} />}
            label="Refresh requests"
            size={hit.min}
            onPress={() => void requests.refetch()}
            disabled={requests.isFetching}
          />
        }
      />

      <SegmentedControl options={options} value={filter} onChange={setFilter} />

      {requests.isError ? (
        <ErrorState message="Requests could not be loaded." onRetry={() => void requests.refetch()} />
      ) : requests.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          {filter !== 'ALL' && items.length === 0 && all.length > 0 ? (
            <Notice message={`No requests match the ${FILTERS.find((option) => option.value === filter)?.label ?? 'selected'} filter.`} tone="info" />
          ) : null}
          {filter !== 'ALL' && items.length > 0 ? (
            <Notice message={`Showing ${items.length} of ${all.length} requests.`} tone="info" />
          ) : null}
          {items.length ? (
            <View style={{ gap: spacing.md }}>
              {items.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onPress={() => router.push({ pathname: '/provider/request/[id]', params: { id: request.id } })}
                />
              ))}
            </View>
          ) : (
            <Card
              variant="muted"
              style={[
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                  borderWidth: borderWidth.thin,
                  borderRadius: radius.lg,
                },
                elevation.subtle,
              ]}
            >
              <EmptyState title={emptyCopy[filter].title} message={emptyCopy[filter].message} />
            </Card>
          )}
        </>
      )}

      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/provider/services' })} style={styles.footer}>
        <Text style={[typography.caption, { color: colors.textMuted }]}>Want more relevant requests? Keep your services up to date.</Text>
        <Text style={[typography.small, { color: colors.primaryDark }]}>Manage services →</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: 4, paddingVertical: 4 },
});
