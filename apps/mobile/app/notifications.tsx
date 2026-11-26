import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck } from 'lucide-react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Badge } from '@/src/components/ui/Badges';
import { Button } from '@/src/components/ui/Button';
import { Card, SectionHeader } from '@/src/components/ui/Card';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useToast } from '@/src/components/ui/Toast';
import { queryKeys, useNotificationPreferences, useNotifications } from '@/src/hooks/queries';
import { notificationsApi } from '@/src/services/api/endpoints/notifications';
import { toApiError } from '@/src/services/api/errors';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { spacing, typography } from '@/src/theme/metrics';
import type { NotificationItem } from '@/src/types/api';
import { formatDate, humanize } from '@/src/utils/format';

type Tab = 'list' | 'preferences';

function stringData(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value ? value : null;
}

function routeFor(item: NotificationItem, role?: string): Href | null {
  const data = item.data;
  const savedSearchId = stringData(data, 'savedSearchId');
  if (savedSearchId) return '/saved-searches';
  const conversationId = stringData(data, 'conversationId');
  if (conversationId) return { pathname: '/messages/[id]', params: { id: conversationId } };
  const disputeId = stringData(data, 'disputeId');
  if (disputeId) return { pathname: '/disputes/[id]', params: { id: disputeId } };
  const bookingId = stringData(data, 'bookingId');
  if (bookingId) return { pathname: '/booking/[id]', params: { id: bookingId } };
  const requestId = stringData(data, 'requestId');
  if (requestId) {
    return role === 'PROVIDER'
      ? { pathname: '/(provider)/provider/request/[id]', params: { id: requestId } }
      : { pathname: '/request/[id]', params: { id: requestId } };
  }
  const providerId = stringData(data, 'providerId');
  if (providerId) return { pathname: '/provider/[id]', params: { id: providerId } };
  if (item.type === 'VERIFICATION_UPDATED' || item.type === 'VERIFICATION_EXPIRING') return '/verification';
  if (item.type === 'NEW_REVIEW' || item.type === 'REVIEW_RESPONSE') return '/reviews';
  return null;
}

export default function NotificationsScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { colors, borderWidth } = useTheme();
  const role = useAuthStore((state) => state.user?.role);
  const [tab, setTab] = useState<Tab>(params.tab === 'preferences' ? 'preferences' : 'list');
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const notifications = useNotifications();
  const preferences = useNotificationPreferences();

  useEffect(() => {
    setTab(params.tab === 'preferences' ? 'preferences' : 'list');
  }, [params.tab]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
    ]);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: async () => {
      await invalidate();
      showToast('All notifications marked as read.', 'success');
    },
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });
  const updatePreference = useMutation({
    mutationFn: notificationsApi.updatePreference,
    onSuccess: invalidate,
    onError: (error) => setNotice({ message: toApiError(error).message, tone: 'error' }),
  });

  const unread = notifications.data?.unreadCount ?? 0;
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: NotificationItem[] }> = [];
    (notifications.data?.items ?? []).forEach((item) => {
      const label = formatDate(item.createdAt);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    });
    return groups;
  }, [notifications.data?.items]);

  const open = (item: NotificationItem, route: Href) => {
    if (!item.readAt) markRead.mutate(item.id);
    router.push(route);
  };

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Notifications"
        eyebrow={unread ? `${unread} unread` : 'Inbox'}
        subtitle="Activity across your marketplace"
        action={
          unread ? (
            <Button
              label="Read all"
              size="sm"
              variant="secondary"
              icon={<CheckCheck size={14} color={colors.primaryDark} />}
              loading={markAll.isPending}
              onPress={() => markAll.mutate()}
            />
          ) : undefined
        }
      />
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Inbox', value: 'list', count: unread || undefined },
          { label: 'Settings', value: 'preferences' },
        ]}
      />
      <Notice message={notice?.message ?? null} tone={notice?.tone} />

      {tab === 'list' ? (
        notifications.isError ? (
          <ErrorState message="Notifications could not be loaded." onRetry={() => void notifications.refetch()} />
        ) : notifications.isPending ? (
          <ListSkeleton rows={4} />
        ) : notifications.data?.items.length ? (
          grouped.map((group) => (
            <View key={group.label} style={{ gap: spacing.sm }}>
              <SectionHeader title={group.label} />
              {group.items.map((item) => {
                const route = routeFor(item, role);
                return (
                  <Card
                    key={item.id}
                    variant={item.readAt ? 'default' : 'elevated'}
                    onPress={route ? () => open(item, route) : undefined}
                    style={[styles.notification, { borderWidth: borderWidth.thin, borderColor: item.readAt ? colors.border : colors.primary }]}
                  >
                    <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                      <Bell size={16} color={colors.primaryDark} />
                    </View>
                    <View style={styles.detail}>
                      <View style={styles.titleRow}>
                        <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!item.readAt ? <Badge label="New" tone="accent" /> : null}
                      </View>
                      {item.body ? <Text style={[typography.small, { color: colors.textMuted }]}>{item.body}</Text> : null}
                      <View style={styles.meta}>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>{formatDate(item.createdAt)}</Text>
                        {item.readAt ? (
                          <View style={styles.read}>
                            <Check size={14} color={colors.success} />
                            <Text style={[typography.caption, { color: colors.success }]}>Read</Text>
                          </View>
                        ) : null}
                        {route ? (
                          <Text style={[typography.caption, { color: colors.primaryDark }]}>Open</Text>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))
        ) : (
          <EmptyState
            icon={<Bell size={28} color={colors.primary} />}
            title="You're all caught up"
            message="New activity will show up here."
          />
        )
      ) : preferences.isError ? (
        <ErrorState message="Preferences could not be loaded." onRetry={() => void preferences.refetch()} />
      ) : preferences.isPending ? (
        <ListSkeleton rows={3} />
      ) : (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Delivery channels" subtitle="Choose how you hear about each kind of activity." />
          {preferences.data?.map((preference) => (
            <Card key={preference.category}>
              <Text style={[typography.bodyStrong, { color: colors.text }]}>
                {preference.label ?? humanize(preference.category)}
              </Text>
              {preference.description ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{preference.description}</Text>
              ) : null}
              {(['inApp', 'push', 'email'] as const).map((channel) => (
                <View key={channel} style={styles.prefRow}>
                  <Text style={[typography.small, { color: colors.textSecondary }]}>{humanize(channel)}</Text>
                  <Switch
                    value={preference[channel]}
                    accessibilityLabel={`${preference.label ?? humanize(preference.category)} ${humanize(channel)}`}
                    disabled={updatePreference.isPending}
                    onValueChange={(value) => updatePreference.mutate({ ...preference, [channel]: value })}
                  />
                </View>
              ))}
            </Card>
          ))}
          {!preferences.data?.length ? (
            <EmptyState title="No preferences yet" message="Notification channels will appear once they are configured." />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notification: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detail: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  read: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  prefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
