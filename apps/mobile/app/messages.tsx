import { MessageCircle } from 'lucide-react-native';
import { useRouter, useSegments } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Avatar, Badge } from '@/src/components/ui/Badges';
import { Card } from '@/src/components/ui/Card';
import { Screen } from '@/src/components/ui/Screen';
import { SearchBar } from '@/src/components/ui/SearchBar';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { ListSkeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useConversations } from '@/src/hooks/queries';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import { formatDate, truncate } from '@/src/utils/format';

type Filter = 'all' | 'unread';

export default function MessagesScreen() {
  const router = useRouter();
  const segments = useSegments();
  const { colors, spacing, typography, borderWidth } = useTheme();
  const user = useAuthStore((state) => state.user);
  const conversations = useConversations();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const items = conversations.data ?? [];
  const unread = items.reduce((total, item) => total + (item.unreadCount ?? 0), 0);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((conversation) => {
      if (filter === 'unread' && !(conversation.unreadCount ?? 0)) return false;
      if (!needle) return true;
      const other = conversation.participants?.find((participant) => participant.id !== user?.id);
      const name = conversation.provider?.businessName ??
        [other?.firstName, other?.lastName].filter(Boolean).join(' ');
      return [name, conversation.lastMessage?.body, conversation.serviceRequest?.title]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
  }, [filter, items, query, user?.id]);

  const isProvider = user?.role === 'PROVIDER';
  const eyebrow = isProvider
    ? 'Provider workspace'
    : user?.role === 'CLIENT'
      ? 'Customer workspace'
      : undefined;

  return (
    <Screen contentStyle={{ gap: spacing.lg }}>
      <AppScreenHeader
        title="Messages"
        eyebrow={eyebrow}
        subtitle={unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Your conversations'}
        back={!segments.includes('(tabs)')}
      />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search conversations" />
      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { label: 'All', value: 'all', count: items.length },
          { label: 'Unread', value: 'unread', count: unread },
        ]}
      />

      {conversations.isError ? (
        <ErrorState message="Conversations could not be loaded." onRetry={() => void conversations.refetch()} />
      ) : conversations.isPending ? (
        <ListSkeleton rows={4} />
      ) : visible.length ? (
        <View style={{ gap: spacing.sm }}>
          {visible.map((conversation) => {
            const other = conversation.participants?.find((participant) => participant.id !== user?.id);
            const name =
              conversation.provider?.businessName ??
              ([other?.firstName, other?.lastName].filter(Boolean).join(' ') || 'Conversation');
            const preview = conversation.lastMessage?.body
              ? truncate(conversation.lastMessage.body, 80)
              : conversation.lastMessage?.attachments?.length
                ? 'Attachment'
                : 'No messages yet';
            return (
              <Card
                key={conversation.id}
                variant="elevated"
                onPress={() => router.push({ pathname: '/messages/[id]', params: { id: conversation.id } })}
                style={[styles.row, { borderWidth: borderWidth.thin }]}
              >
                <Avatar uri={conversation.provider?.avatarUrl ?? other?.avatarUrl} name={name} size={48} />
                <View style={styles.detail}>
                  <View style={styles.line}>
                    <Text style={[typography.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      {formatDate(conversation.updatedAt)}
                    </Text>
                  </View>
                  <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={1}>
                    {preview}
                  </Text>
                  <View style={styles.meta}>
                    {conversation.serviceRequest?.title ? (
                      <Text style={[typography.caption, { color: colors.primaryDark }]} numberOfLines={1}>
                        {conversation.serviceRequest.title}
                      </Text>
                    ) : null}
                    {conversation.unreadCount ? <Badge label={`${conversation.unreadCount} new`} tone="accent" /> : null}
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState
          icon={<MessageCircle size={28} color={colors.primary} />}
          title={query || filter === 'unread' ? 'No matching conversations' : 'No conversations yet'}
          message={
            query || filter === 'unread'
              ? 'Try another search or switch back to all conversations.'
                : isProvider
                  ? 'Conversations start when a client messages you about a service request.'
                  : 'Message a provider from their profile to start a conversation.'
          }
          actionLabel={(query || filter === 'unread') && items.length ? 'Show all' : isProvider ? 'Go to provider workspace' : 'Browse providers'}
          onAction={() =>
            (query || filter === 'unread') && items.length
              ? (setQuery(''), setFilter('all'))
              : router.push(isProvider ? '/provider' : '/explore')
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  detail: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
