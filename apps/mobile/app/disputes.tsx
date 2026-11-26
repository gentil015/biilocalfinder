import { useQuery } from '@tanstack/react-query';
import { Plus, Scale } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { parityCustomerApi } from '@/src/services/api/endpoints/parity-customer';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { formatDate, humanize } from '@/src/utils/format';

type Filter = 'all' | 'open';

const OPEN_STATUSES = ['OPEN', 'RESPONDED', 'UNDER_REVIEW'];

function tone(status: string): 'warning' | 'success' | 'neutral' {
  if (OPEN_STATUSES.includes(status)) return 'warning';
  if (status === 'RESOLVED') return 'success';
  return 'neutral';
}

export default function DisputesScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const router = useRouter();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('all');
  const disputes = useQuery({ queryKey: ['disputes', 'mine'], queryFn: () => parityCustomerApi.myDisputes() });
  const all = disputes.data ?? [];
  const openCount = all.filter((dispute) => OPEN_STATUSES.includes(dispute.status)).length;
  const items = filter === 'open' ? all.filter((dispute) => OPEN_STATUSES.includes(dispute.status)) : all;

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Disputes"
        eyebrow="Resolution center"
        subtitle={all.length ? `${openCount} open of ${all.length} total` : 'Structured help when a booking goes wrong'}
        action={
          <Button
            label="New"
            size="sm"
            variant="secondary"
            icon={<Plus size={14} color={colors.primaryDark} />}
            onPress={() => router.push('/disputes/new')}
          />
        }
      />
      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { label: 'All', value: 'all', count: all.length || undefined },
          { label: 'Open', value: 'open', count: openCount || undefined },
        ]}
      />

      {disputes.isError ? (
        <ErrorState message="Disputes could not be loaded." onRetry={() => void disputes.refetch()} />
      ) : disputes.isPending ? (
        <ListSkeleton rows={3} />
      ) : items.length ? (
        <View style={{ gap: spacing.sm }}>
          {items.map((dispute) => (
            <Card
              key={dispute.id}
              variant="elevated"
              onPress={() => router.push({ pathname: '/disputes/[id]', params: { id: dispute.id } })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Badge label={humanize(dispute.category)} />
                  <Text numberOfLines={2} style={[typography.bodyStrong, { color: colors.text }]}>
                    {dispute.reason}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Opened {formatDate(dispute.createdAt)}</Text>
                </View>
                <Badge label={humanize(dispute.status)} tone={tone(dispute.status)} />
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Scale size={24} color={colors.primaryDark} />}
          title={filter === 'open' && all.length ? 'No open disputes' : 'No disputes'}
          message={
            filter === 'open' && all.length
              ? 'Every dispute is closed.'
              : 'If a booking goes wrong, open a dispute to start a structured conversation.'
          }
          actionLabel={filter === 'open' && all.length ? 'Show all' : 'Open a dispute'}
          onAction={() => (filter === 'open' && all.length ? setFilter('all') : router.push('/disputes/new'))}
        />
      )}
    </Screen>
  );
}
