import { useRouter } from 'expo-router';
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Eye,
  MessageSquareText,
  ShieldAlert,
  TrendingUp,
  UserRound,
  Wrench,
} from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BookingCard } from '@/src/components/domain/BookingCard';
import { RequestCard } from '@/src/components/domain/RequestCard';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { IconButton } from '@/src/components/ui/IconButton';
import { MenuRow } from '@/src/components/ui/MenuRow';
import { Notice } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { ListSkeleton, Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useBookings, useIncomingRequests, useProviderAnalytics, useProviderProfile, useVerification } from '@/src/hooks/queries';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { humanize, statusLabel } from '@/src/utils/format';

function asCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asNamedCount(value: unknown): { name: string; count: number | null } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.serviceName !== 'string' || !record.serviceName.trim()) return null;
  return { name: record.serviceName, count: asCount(record.count) };
}

type PriorityRoute = '/verification' | '/verify-contact' | '/provider/portfolio' | '/provider/requests' | '/provider/profile';

export default function ProviderOverviewScreen() {
  const router = useRouter();
  const { colors, spacing, radius, typography, borderWidth, hit, layout } = useTheme();
  const user = useAuthStore((state) => state.user);
  const analytics = useProviderAnalytics();
  const requests = useIncomingRequests();
  const bookings = useBookings(true);
  const verification = useVerification();
  const profile = useProviderProfile();
  const refreshing = analytics.isFetching || requests.isFetching || bookings.isFetching || verification.isFetching || profile.isFetching;

  const nextSteps = asStringList(verification.data?.nextSteps);
  const verificationStatus = String(verification.data?.status ?? 'UNVERIFIED');
  const flags = {
    phone: verification.data?.hasPhone === true && verification.data?.phoneVerified === true,
    email: verification.data?.emailVerified === true,
    identity: verification.data?.identityVerified === true || verificationStatus === 'VERIFIED',
    review: verificationStatus === 'VERIFIED',
  };
  const completedSteps = Object.values(flags).filter(Boolean).length;
  const steps = [
    { label: 'Phone', done: flags.phone },
    { label: 'Email', done: flags.email },
    { label: 'Identity', done: flags.identity },
    { label: 'Review', done: flags.review },
  ];
  const profileViews = asCount(analytics.data?.profileViews);
  const serviceViews = asCount(analytics.data?.serviceViews);
  const requestCount = asCount(analytics.data?.requests);
  const quotesSent = asCount(analytics.data?.quotesSent);
  const bookingCount = asCount(analytics.data?.bookings);
  const conversionRate = asCount(analytics.data?.conversionRate);
  const topSearchedService = asNamedCount(analytics.data?.topSearchedService);
  const mostViewedService = asNamedCount(analytics.data?.mostViewedService);
  const periodLabel = typeof analytics.data?.periodLabel === 'string' ? analytics.data.periodLabel : undefined;
  const funnel = [
    { label: 'Profile views', value: profileViews, icon: <Eye size={16} color={colors.primaryDark} /> },
    { label: 'Service views', value: serviceViews, icon: <Wrench size={16} color={colors.primaryDark} /> },
    { label: 'Requests', value: requestCount, icon: <ClipboardList size={16} color={colors.primaryDark} /> },
    { label: 'Quotes sent', value: quotesSent, icon: <MessageSquareText size={16} color={colors.primaryDark} /> },
    { label: 'Bookings', value: bookingCount, icon: <CalendarDays size={16} color={colors.primaryDark} /> },
  ];
  const funnelMax = Math.max(0, ...funnel.map((step) => step.value ?? 0));
  const openRequest = requests.data?.some((request) => request.status === 'OPEN');

  const contactStep = nextSteps.find((step) => step === 'ADD_PHONE' || step === 'VERIFY_PHONE' || step === 'VERIFY_EMAIL');
  const priority: { title: string; message: string; route: PriorityRoute; icon: ReactNode } | null = nextSteps.length
    ? {
        title: contactStep ? 'Verify your contact details' : 'Complete your verification',
        message: `Next: ${nextSteps.map(humanize).join(', ')}.`,
        route: contactStep ? '/verify-contact' : '/verification',
        icon: <ShieldAlert size={18} color={colors.warning} />,
      }
    : profileViews !== null && profileViews > 0 && requestCount === 0
      ? {
          title: 'Turn views into requests',
          message: `People viewed your profile ${periodLabel ? periodLabel.toLowerCase() : 'this period'}, but no requests were received. Consider adding more portfolio photos.`,
          route: '/provider/portfolio',
          icon: <TrendingUp size={18} color={colors.primary} />,
        }
      : openRequest
        ? {
            title: 'Respond to an open request',
            message: 'An incoming request is waiting for a quote.',
            route: '/provider/requests',
            icon: <ClipboardList size={18} color={colors.primary} />,
          }
        : profile.data && !profile.data.description?.trim()
          ? {
              title: 'Add a business description',
              message: 'A short description helps clients understand what you offer.',
              route: '/provider/profile',
              icon: <UserRound size={18} color={colors.primary} />,
            }
          : null;

  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: borderWidth.thin,
    borderRadius: radius.lg,
  };
  const surfaceStyle = { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void Promise.all([analytics.refetch(), requests.refetch(), bookings.refetch(), verification.refetch(), profile.refetch()])}
          tintColor={colors.primary}
        />
      }
      contentStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, maxWidth: layout.maxContentWidth, width: '100%' }}
    >
      <AppScreenHeader
        eyebrow="Provider workspace"
        title={profile.data?.businessName ?? `Hello, ${user?.firstName ?? 'there'}`}
        subtitle={user?.email ?? 'Manage your business at a glance'}
        back={false}
        large
        action={<IconButton icon={<BarChart3 size={20} />} label="Open insights" variant="surface" size={hit.min} onPress={() => router.push('/provider/insights')} />}
      />

      <Card variant="elevated" style={cardStyle}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={[typography.eyebrow, { color: colors.primary }]}>Verification</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Text style={[typography.h3, { color: colors.text }]}>{statusLabel.verification(verificationStatus)}</Text>
              <Badge label={`${completedSteps} of ${steps.length} steps`} tone={verificationStatus === 'VERIFIED' ? 'success' : 'warning'} />
            </View>
          </View>
          <IconButton icon={<ArrowRight size={18} />} label="Manage verification" variant="ghost" size={hit.compact} onPress={() => router.push('/verification')} />
        </View>
        {verification.isLoading ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {steps.map((step) => <Skeleton key={step.label} height={44} style={{ flex: 1 }} />)}
          </View>
        ) : verification.isError ? (
          <Notice message="Verification status could not be loaded." tone="error" />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {steps.map((step, index) => (
              <View key={step.label} style={{ flex: 1, gap: spacing.xs }}>
                <View style={[styles.stepLine, { backgroundColor: step.done ? colors.primary : colors.borderStrong }]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: step.done ? colors.primarySoft : surfaceStyle.backgroundColor,
                        borderColor: step.done ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {step.done ? <BadgeCheck size={14} color={colors.primaryDark} /> : <Text style={[typography.caption, { color: colors.textMuted }]}>{index + 1}</Text>}
                  </View>
                  <Text style={[typography.caption, { color: step.done ? colors.text : colors.textMuted }]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {nextSteps.length ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/verification')} style={[styles.alert, { backgroundColor: colors.warningSoft, borderColor: colors.warning, borderRadius: radius.md, borderWidth: borderWidth.thin }]}>
            <ShieldAlert size={18} color={colors.warning} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[typography.bodyStrong, { color: colors.warning }]}>Complete your verification</Text>
              <Text style={[typography.caption, { color: colors.warning }]}>Next: {nextSteps.map(humanize).join(', ')}</Text>
            </View>
            <ArrowRight size={18} color={colors.warning} />
          </Pressable>
        ) : null}
      </Card>

      {priority ? (
        <Card variant="elevated" style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            {priority.icon}
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={[typography.eyebrow, { color: colors.primary }]}>Priority action</Text>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>{priority.title}</Text>
              <Text style={[typography.small, { color: colors.textSecondary }]}>{priority.message}</Text>
              <Button
                label="Open"
                size="sm"
                onPress={() => router.push(priority.route)}
                icon={<ArrowRight size={15} color={colors.white} />}
              />
            </View>
          </View>
        </Card>
      ) : (
        <Notice message="Nothing needs attention based on the data available right now." tone="info" />
      )}

      <View>
        <SectionHeader title="Performance" subtitle={periodLabel} />
        {analytics.isError ? (
          <ErrorState message="Analytics could not be loaded." onRetry={() => void analytics.refetch()} />
        ) : analytics.isLoading ? (
          <View style={styles.metrics}>
            {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} height={82} style={{ flex: 1, minWidth: 132, borderRadius: radius.md }} />)}
          </View>
        ) : (
          <View style={styles.metrics}>
            <Metric icon={<Eye size={16} color={colors.primaryDark} />} label="Profile views" value={formatCount(profileViews)} />
            <Metric icon={<Wrench size={16} color={colors.primaryDark} />} label="Service views" value={formatCount(serviceViews)} />
            <Metric icon={<ClipboardList size={16} color={colors.primaryDark} />} label="Requests" value={formatCount(requestCount)} />
            <Metric icon={<MessageSquareText size={16} color={colors.primaryDark} />} label="Quotes sent" value={formatCount(quotesSent)} />
            <Metric icon={<BadgeCheck size={16} color={colors.primaryDark} />} label="Bookings" value={formatCount(bookingCount)} />
            <Metric
              icon={<TrendingUp size={16} color={colors.primaryDark} />}
              label="Conversion"
              value={requestCount !== null && requestCount > 0 ? formatPercent(conversionRate) : requestCount === null ? '—' : 'No requests yet'}
            />
          </View>
        )}
      </View>

      {!analytics.isError && !analytics.isLoading ? (
        <Card style={cardStyle}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TrendingUp size={18} color={colors.primaryDark} />
              <Text style={[typography.bodyStrong, { color: colors.text }]}>Activity funnel</Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>{periodLabel ?? 'Current period'}</Text>
            </View>
            {funnelMax === 0 ? (
              <Text style={[typography.small, { color: colors.textMuted }]}>No activity recorded yet. Counts appear as clients visit and contact you.</Text>
            ) : (
              funnel.map((step) => {
                const width = ((step.value ?? 0) / funnelMax) * 100;
                return (
                  <View key={step.label} style={{ gap: spacing.xs }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 18, alignItems: 'center' }}>{step.icon}</View>
                      <Text style={[typography.small, { color: colors.textSecondary, flex: 1 }]}>{step.label}</Text>
                      <Text style={[typography.bodyStrong, { color: colors.text }]}>{formatCount(step.value)}</Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
                      <View style={[styles.barFill, { backgroundColor: colors.primary, width: `${width}%` as `${number}%` }]} />
                    </View>
                  </View>
                );
              })
            )}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <NamedCountRow label="Top searched service" value={topSearchedService?.name} count={topSearchedService?.count} unit="searches" />
            <NamedCountRow label="Most viewed service" value={mostViewedService?.name} count={mostViewedService?.count} unit="views" />
          </View>
        </Card>
      ) : null}

      <View>
        <SectionHeader
          title="Incoming requests"
          action={
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/provider/requests' })}>
              <Text style={[typography.small, { color: colors.primaryDark }]}>View all</Text>
            </Pressable>
          }
        />
        {requests.isError ? (
          <ErrorState message="Requests could not be loaded." onRetry={() => void requests.refetch()} />
        ) : requests.isLoading ? (
          <ListSkeleton rows={3} />
        ) : requests.data?.length ? (
          <View style={{ gap: spacing.md }}>
            {requests.data.slice(0, 3).map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onPress={() => router.push({ pathname: '/provider/request/[id]', params: { id: request.id } })}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No incoming requests" message="New client requests will appear here." />
        )}
      </View>

      <View>
        <SectionHeader title="Upcoming bookings" />
        {bookings.isError ? (
          <ErrorState message="Bookings could not be loaded." onRetry={() => void bookings.refetch()} />
        ) : bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : bookings.data?.length ? (
          <View style={{ gap: spacing.md }}>
            {bookings.data.slice(0, 3).map((booking) => (
              <BookingCard key={booking.id} booking={booking} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: booking.id } })} />
            ))}
          </View>
        ) : (
          <EmptyState title="No bookings yet" message="Accepted quotes become bookings here." />
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Shortcuts" subtitle="Jump straight to a workspace area" />
        <Card style={cardStyle}>
          <View style={{ gap: spacing.xs }}>
            <MenuRow icon={<BarChart3 size={18} color={colors.primaryDark} />} label="Insights & profile strength" onPress={() => router.push('/provider/insights')} />
            <MenuRow icon={<Wrench size={18} color={colors.primaryDark} />} label="Manage services" onPress={() => router.push('/provider/services')} />
            <MenuRow icon={<ClipboardList size={18} color={colors.primaryDark} />} label="Review requests" onPress={() => router.push({ pathname: '/provider/requests' })} />
            <MenuRow icon={<UserRound size={18} color={colors.primaryDark} />} label="Business profile" onPress={() => router.push('/provider/profile')} />
            <MenuRow icon={<ShieldAlert size={18} color={colors.primaryDark} />} label="Verification" onPress={() => router.push('/verification')} />
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function formatCount(value: number | null): string {
  return value === null ? '—' : String(value);
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const { colors, spacing, radius, typography, borderWidth, elevation } = useTheme();
  return (
    <View
      style={[
        styles.metric,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: borderWidth.thin,
          borderRadius: radius.md,
          gap: spacing.xs,
        },
        elevation.subtle,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>{icon}</View>
      <Text style={[typography.metric, { color: colors.primaryDark }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function NamedCountRow({ label, value, count, unit }: { label: string; value?: string; count?: number | null; unit: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text style={[typography.small, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[typography.bodyStrong, { color: value ? colors.text : colors.textMuted, flexShrink: 1, textAlign: 'right' }]} numberOfLines={1}>
        {value ? `${value}${count !== null && count !== undefined ? ` · ${count} ${unit}` : ''}` : 'Not enough data yet'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  alert: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metric: { flex: 1, minWidth: 132, padding: 12 },
  stepLine: { height: 3, borderRadius: 999 },
  stepDot: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  divider: { height: 1 },
});
