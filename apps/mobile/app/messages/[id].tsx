import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Paperclip, Send } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { AppScreenHeader } from '@/src/components/ui/AppScreenHeader';
import { Avatar } from '@/src/components/ui/Badges';
import { IconButton } from '@/src/components/ui/IconButton';
import { Notice, type NoticeTone } from '@/src/components/ui/Notice';
import { Screen } from '@/src/components/ui/Screen';
import { Skeleton } from '@/src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/src/components/ui/States';
import { useMessages } from '@/src/hooks/queries';
import { filesApi } from '@/src/services/api/endpoints/files';
import { messagingApi } from '@/src/services/api/endpoints/messaging';
import { toApiError } from '@/src/services/api/errors';
import { connectSocket, getSocket } from '@/src/services/socket';
import { useAuthStore } from '@/src/stores/auth.store';
import { useTheme } from '@/src/theme/ThemeProvider';
import type { ChatMessage } from '@/src/types/api';
import { formatDate, formatTime } from '@/src/utils/format';

type PendingSend = {
  id: string;
  body: string;
  attachment?: boolean;
  storageKey?: string;
  retrying?: boolean;
  status: 'pending' | 'failed';
  createdAt: string;
};

function dayLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDate(value);
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius, typography, borderWidth, hit } = useTheme();
  const user = useAuthStore((state) => state.user);
  const messages = useMessages(id);
  const conversation = useQuery({
    queryKey: ['conversation', id ?? ''],
    queryFn: () => messagingApi.conversation(id!),
    enabled: Boolean(id),
  });
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingSend[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: NoticeTone } | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const nextPendingId = useRef(0);

  const clearSendTimer = useCallback((localId: string) => {
    const timer = sendTimers.current[localId];
    if (timer) {
      clearTimeout(timer);
      delete sendTimers.current[localId];
    }
  }, []);

  const queueSend = useCallback(
    (body: string, attachment = false, storageKey?: string) => {
      const localId = `pending-${++nextPendingId.current}`;
      setPending((current) => [
        ...current,
        { id: localId, body, attachment, storageKey, status: 'pending', createdAt: new Date().toISOString() },
      ]);
      sendTimers.current[localId] = setTimeout(() => {
        setPending((current) =>
          current.map((item) => (item.id === localId ? { ...item, status: 'failed', retrying: false } : item)),
        );
        delete sendTimers.current[localId];
      }, 10000);
      return localId;
    },
    [],
  );

  const resolveSend = useCallback(
    (localId: string) => {
      clearSendTimer(localId);
      setPending((current) => current.filter((item) => item.id !== localId));
    },
    [clearSendTimer],
  );

  useEffect(() => {
    if (messages.data) setItems(messages.data);
  }, [messages.data]);

  useEffect(() => {
    if (!id) return;
    let cleanup = () => {};
    void (async () => {
      try {
        const socket = await connectSocket();
        if (!socket) return;
        socket.emit('conversation:join', id);
        const onNew = (message: ChatMessage) => {
          if (message.conversationId !== id) return;
          setItems((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
          if (message.senderId === user?.id && message.body) {
            setPending((current) => {
              const match = current.find(
                (item) => item.status === 'pending' && !item.attachment && item.body === message.body,
              );
              if (!match) return current;
              clearSendTimer(match.id);
              return current.filter((item) => item.id !== match.id);
            });
          }
        };
        const onTyping = (payload: { userId: string; isTyping: boolean }) => {
          if (payload.userId !== user?.id) setTyping(payload.isTyping);
        };
        socket.on('message:new', onNew);
        socket.on('typing', onTyping);
        void messagingApi.markRead(id).catch(() => undefined);
        cleanup = () => {
          socket.off('message:new', onNew);
          socket.off('typing', onTyping);
        };
      } catch {
        setNotice({ message: 'Live chat is unavailable; messages will still send over HTTP.', tone: 'info' });
      }
    })();
    return () => cleanup();
  }, [clearSendTimer, id, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [items.length, pending.length, typing]);

  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      Object.values(sendTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const send = async (override?: string, retryId?: string) => {
    const body = (override ?? draft).trim();
    if (!body || !id) return;
    setDraft('');
    setNotice(null);
    getSocket()?.emit('typing', { conversationId: id, isTyping: false });
    const localId = retryId ?? queueSend(body);
    if (retryId) {
      setPending((current) => current.map((item) => (item.id === retryId ? { ...item, status: 'pending', retrying: true } : item)));
    }
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:send', { conversationId: id, body });
      return;
    }
    try {
      const message = await messagingApi.sendMessage(id, body);
      setItems((current) => [...current, message]);
      resolveSend(localId);
    } catch (error) {
      setPending((current) =>
        current.map((item) => (item.id === localId ? { ...item, status: 'failed', retrying: false } : item)),
      );
      clearSendTimer(localId);
      setNotice({ message: toApiError(error).message, tone: 'error' });
      setDraft(body);
    }
  };

  const retryAttachment = async (item: PendingSend) => {
    if (!id || !item.storageKey || item.retrying) return;
    setNotice(null);
    setPending((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, status: 'pending', retrying: true } : entry)),
    );
    try {
      const message = await messagingApi.sendMessage(id, '', [{ storageKey: item.storageKey }]);
      setItems((current) => [...current, message]);
      resolveSend(item.id);
    } catch (error) {
      setPending((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, status: 'failed', retrying: false } : entry)),
      );
      setNotice({ message: toApiError(error).message, tone: 'error' });
    }
  };

  const attach = async () => {
    if (!id) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    let localId: string | undefined;
    try {
      const uploaded = await filesApi.uploadMessageAttachment(id, result.assets[0]);
      localId = queueSend('Attachment', true, uploaded.storageKey);
      const message = await messagingApi.sendMessage(id, '', [{ storageKey: uploaded.storageKey }]);
      setItems((current) => [...current, message]);
      resolveSend(localId);
    } catch (error) {
      if (localId) {
        setPending((current) =>
          current.map((entry) => (entry.id === localId ? { ...entry, status: 'failed', retrying: false } : entry)),
        );
        clearSendTimer(localId);
      }
      setNotice({ message: toApiError(error).message, tone: 'error' });
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!id) return;
    getSocket()?.emit('typing', { conversationId: id, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      getSocket()?.emit('typing', { conversationId: id, isTyping: false });
    }, 1200);
  };

  const other = conversation.data?.participants?.find((participant) => participant.id !== user?.id);
  const title =
    conversation.data?.provider?.businessName ||
    [other?.firstName, other?.lastName].filter(Boolean).join(' ') ||
    'Conversation';
  const avatarUri = conversation.data?.provider?.avatarUrl ?? other?.avatarUrl;
  const grouped = useMemo(() => {
    let previous = '';
    return items.map((message) => {
      const label = dayLabel(message.createdAt);
      const separator = label && label !== previous ? label : null;
      previous = label;
      return { message, separator };
    });
  }, [items]);

  return (
    <Screen
      scroll={false}
      padded={false}
      edges={['top', 'bottom']}
      contentStyle={styles.root}
      style={{ backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: borderWidth.thin }]}>
          <AppScreenHeader
            title={title}
            eyebrow="Conversation"
            subtitle={conversation.data?.serviceRequest?.title ?? undefined}
            action={<Avatar uri={avatarUri} name={title} size={hit.compact} />}
          />
        </View>

        <View style={styles.notice}>
          <Notice message={notice?.message ?? null} tone={notice?.tone} />
        </View>

        <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
          {messages.isError ? (
            <ErrorState message="Messages could not be loaded." onRetry={() => void messages.refetch()} />
          ) : messages.isPending && !items.length ? (
            <View style={{ gap: spacing.sm }}>
              <Skeleton width="70%" height={44} style={{ alignSelf: 'flex-start' }} />
              <Skeleton width="60%" height={44} style={{ alignSelf: 'flex-end' }} />
              <Skeleton width="75%" height={44} style={{ alignSelf: 'flex-start' }} />
            </View>
          ) : grouped.length ? (
            grouped.map(({ message, separator }) => {
              const mine = message.senderId === user?.id;
              return (
                <View key={message.id} style={styles.group}>
                  {separator ? (
                    <View style={styles.separator}>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>{separator}</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      {
                        backgroundColor: mine ? colors.primary : colors.surface,
                        borderColor: colors.border,
                        alignSelf: mine ? 'flex-end' : 'flex-start',
                        borderWidth: mine ? 0 : borderWidth.thin,
                      },
                    ]}
                  >
                    {!mine ? (
                      <Avatar
                        uri={message.sender?.avatarUrl}
                        name={[message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ') || 'User'}
                        size={24}
                      />
                    ) : null}
                    <View style={styles.bubbleBody}>
                      {message.body ? (
                        <Text style={[typography.small, { color: mine ? colors.white : colors.text }]}>
                          {message.body}
                        </Text>
                      ) : null}
                      {message.attachments?.length ? (
                        <View style={styles.attachments}>
                          {message.attachments.map((attachment, index) =>
                            attachment.url ? (
                              <Image
                                key={`${attachment.storageKey}-${index}`}
                                source={{ uri: attachment.url }}
                                style={styles.thumbnail}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                              />
                            ) : (
                              <View
                                key={`${attachment.storageKey}-${index}`}
                                style={[styles.fileChip, { backgroundColor: mine ? colors.primaryDark : colors.surfaceAlt }]}
                              >
                                <Paperclip size={14} color={mine ? colors.white : colors.textMuted} />
                                <Text
                                  style={[typography.caption, { color: mine ? colors.white : colors.textSecondary }]}
                                  numberOfLines={1}
                                >
                                  {attachment.fileName ?? 'Attachment'}
                                </Text>
                              </View>
                            ),
                          )}
                        </View>
                      ) : null}
                      <Text style={[typography.caption, { color: mine ? colors.white : colors.textMuted }]}>
                        {formatTime(message.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState title="No messages yet" message="Say hello to start the conversation." />
          )}

          {pending.length ? (
            <View style={styles.pendingList}>
              {pending.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={item.retrying ? 'Retrying message' : item.status === 'failed' ? 'Retry sending message' : 'Message sending'}
                  accessibilityState={{ disabled: item.status !== 'failed' || item.retrying, busy: item.status === 'pending' || item.retrying }}
                  disabled={item.status !== 'failed' || item.retrying}
                  onPress={() => {
                    if (item.retrying || item.status !== 'failed') return;
                    if (item.attachment && item.storageKey) void retryAttachment(item);
                    else void send(item.body, item.id);
                  }}
                  style={({ pressed }) => [
                    styles.bubble,
                    styles.pendingBubble,
                    {
                      alignSelf: 'flex-end',
                      borderColor: item.status === 'failed' ? colors.danger : colors.border,
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed && item.status === 'failed' ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[typography.small, { color: colors.text }]}>{item.body}</Text>
                  <Text
                    style={[
                      typography.caption,
                      { color: item.status === 'failed' ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {item.retrying ? 'Retrying…' : item.status === 'failed' ? 'Failed · tap to retry' : 'Sending…'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {typing ? (
            <View
              accessibilityLabel="Other person is typing"
              style={[styles.bubble, styles.typingBubble, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: borderWidth.thin }]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[typography.caption, { color: colors.textMuted }]}>Typing…</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: borderWidth.thin }]}>
          <IconButton
            icon={<Paperclip size={19} />}
            label="Attach image"
            variant="ghost"
            size={hit.min}
            onPress={() => void attach()}
          />
          <TextInput
            accessibilityLabel="Message"
            placeholder="Write a message…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            value={draft}
            onChangeText={onDraftChange}
            onSubmitEditing={() => void send()}
            multiline
            maxLength={5000}
          />
          <IconButton
            icon={<Send size={18} />}
            label="Send message"
            variant="primary"
            size={hit.min}
            disabled={!draft.trim()}
            onPress={() => void send()}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 0, paddingVertical: 0 },
  header: { paddingHorizontal: 12, paddingTop: 8 },
  notice: { paddingHorizontal: 16 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10, justifyContent: 'flex-end', flexGrow: 1 },
  group: { gap: 6 },
  separator: { alignItems: 'center', paddingVertical: 4 },
  bubble: {
    maxWidth: '84%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 16,
  },
  bubbleBody: { gap: 6, flexShrink: 1 },
  attachments: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  thumbnail: { width: 96, height: 96, borderRadius: 12 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, borderRadius: 999, maxWidth: 180 },
  pendingList: { gap: 8, alignItems: 'flex-end' },
  pendingBubble: { borderWidth: 1, gap: 4 },
  typingBubble: { alignSelf: 'flex-start', gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
  },
});
