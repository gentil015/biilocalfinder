import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { AvailabilityDetails, Avatar, Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { RoleGuardLoading } from '@/src/components/layout/RoleGuardLoading';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { parityCustomerApi, type CompareProvider } from '@/src/services/api/endpoints/parity-customer';
import { useRoleGuard } from '@/src/hooks/useRoleGuard';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import { formatMoney, humanize } from '@/src/utils/format';

type CompareAvailability = NonNullable<CompareProvider['availability']> & { todayHours?: string | null };

type CompareRow = {
  key: string;
  label: string;
  render: (provider: CompareProvider) => ReactNode;
};

const ROWS: CompareRow[] = [
  {
    key: 'rating',
    label: 'Rating',
    render: (provider) => (
      <CellText>
        {typeof provider.rating === 'number' && Number.isFinite(provider.rating) && provider.rating > 0
          ? `${provider.rating.toFixed(1)}${typeof provider.reviewCount === 'number' ? ` (${provider.reviewCount})` : ''}`
          : '—'}
      </CellText>
    ),
  },
  {
    key: 'reviews',
    label: 'Reviews',
    render: (provider) => (
      <CellText>{typeof provider.reviewCount === 'number' ? String(provider.reviewCount) : '—'}</CellText>
    ),
  },
  {
    key: 'verifiedReviews',
    label: 'Verified reviews',
    render: (provider) => (
      <CellText>{provider.verifiedReviewCount != null ? String(provider.verifiedReviewCount) : '—'}</CellText>
    ),
  },
  {
    key: 'responseRate',
    label: 'Response rate',
    render: (provider) => {
      const percentage = provider.responseRateSummary?.percentage;
      return <CellText>{percentage != null ? `${Math.round(percentage)}%` : '—'}</CellText>;
    },
  },
  {
    key: 'jobs',
    label: 'Completed jobs',
    render: (provider) => (
      <CellText>{typeof provider.completedJobCount === 'number' ? String(provider.completedJobCount) : '—'}</CellText>
    ),
  },
  {
    key: 'experience',
    label: 'Experience',
    render: (provider) => (
      <CellText>{typeof provider.yearsOfExperience === 'number' ? `${provider.yearsOfExperience} yrs` : '—'}</CellText>
    ),
  },
  {
    key: 'verification',
    label: 'Verification',
    render: (provider) => (
      <Badge
        label={humanize(provider.verificationStatus ?? 'UNVERIFIED')}
        tone={provider.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'}
      />
    ),
  },
  {
    key: 'price',
    label: 'Starting price',
    render: (provider) => <CellText>{formatMoney(provider.startingPrice, provider.currency ?? 'RWF')}</CellText>,
  },
  {
    key: 'availability',
    label: 'Availability',
    render: (provider) => {
      const availability = provider.availability as CompareAvailability | null | undefined;
      const status = provider.availabilityStatus;
      return (
        <View style={styles.availabilityCell}>
          {status ? (
            <Badge
              label={humanize(status)}
              tone={status === 'AVAILABLE' ? 'success' : status === 'BUSY' ? 'warning' : 'neutral'}
            />
          ) : null}
          <AvailabilityDetails
            nextAvailableLabel={availability?.nextAvailableLabel}
            todayHours={availability?.todayHours}
          />
        </View>
      );
    },
  },
];

function CellText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typography.small, { color: colors.text }]}>{children}</Text>;
}

const browseRoute: Href = '/explore';

export default function CompareScreen() {
  const { ready } = useRoleGuard(['CLIENT', 'PROVIDER']);
  const params = useLocalSearchParams<{ ids?: string }>();
  const router = useRouter();
  const { colors, borderWidth } = useTheme();
  const ids = (typeof params.ids === 'string' ? params.ids : '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const comparison = useQuery({
    queryKey: ['compare', ids.join(',')],
    queryFn: () => parityCustomerApi.compareProviders(ids),
    enabled: ids.length >= 2,
  });

  if (!ready) return <RoleGuardLoading />;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Compare providers"
        eyebrow="Side by side"
        subtitle={ids.length >= 2 ? `${ids.length} providers selected` : 'Choose at least two providers'}
      />

      {ids.length < 2 ? (
        <EmptyState
          icon={<Scale size={24} color={colors.primaryDark} />}
          title="Nothing to compare yet"
          message="Choose at least two providers from search results to see their details side by side."
          actionLabel="Browse providers"
          onAction={() => router.push(browseRoute)}
        />
      ) : comparison.isError ? (
        <ErrorState message="Comparison could not be loaded." onRetry={() => void comparison.refetch()} />
      ) : comparison.isPending ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton height={64} />
          {ROWS.map((row) => (
            <Skeleton key={row.key} height={48} />
          ))}
        </View>
      ) : !comparison.data?.length ? (
        <EmptyState
          title="No providers to compare"
          message="One of these providers is no longer available."
          actionLabel="Browse providers"
          onAction={() => router.push(browseRoute)}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            {comparison.data.length} providers compared. Scroll sideways to see every column.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.table}>
            <Card variant="muted" style={styles.tableCard}>
              <View style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: borderWidth.thin }]}>
                <View style={styles.labelCell}>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>Provider</Text>
                </View>
                {comparison.data.map((provider) => (
                  <PressableCell
                    key={provider.id}
                    label={`Open ${provider.businessName}`}
                    onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
                  >
                    <Avatar uri={provider.avatarUrl} name={provider.businessName} size={40} />
                    <View style={{ gap: 2, flex: 1 }}>
                      <Text style={[typography.bodyStrong, { color: colors.primaryDark }]} numberOfLines={2}>
                        {provider.businessName}
                      </Text>
                      {provider.city ? (
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{provider.city}</Text>
                      ) : null}
                    </View>
                  </PressableCell>
                ))}
              </View>
              {ROWS.map((row) => (
                <View key={row.key} style={[styles.row, { borderBottomColor: colors.border, borderBottomWidth: borderWidth.thin }]}>
                  <View style={styles.labelCell}>
                    <Text style={[typography.caption, { color: colors.textSecondary }]}>{row.label}</Text>
                  </View>
                  {comparison.data.map((provider) => (
                    <View key={provider.id} style={styles.cell}>
                      {row.render(provider)}
                    </View>
                  ))}
                </View>
              ))}
            </Card>
          </ScrollView>
          <Button label="Browse more providers" variant="secondary" onPress={() => router.push(browseRoute)} />
        </View>
      )}
    </Screen>
  );
}

function PressableCell({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, styles.cellContent, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: { gap: 0 },
  tableCard: { padding: 0, gap: 0 },
  row: { flexDirection: 'row' },
  labelCell: { width: 116, padding: 12, justifyContent: 'center' },
  cell: { width: 190, minHeight: 56, padding: 12, justifyContent: 'center', gap: 6 },
  cellContent: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  availabilityCell: { gap: spacing.xs },
  pressed: { opacity: 0.75 },
});
