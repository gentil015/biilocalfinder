'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Send } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { messagingApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/components/auth-provider';

/** Same calendar day as `d`, ignoring time of day. */
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function senderName(m: any, mine: boolean) {
  if (mine) return 'You';
  const s = m?.sender;
  if (!s) return 'Them';
  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim();
  return name || 'Them';
}

export default function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [body, setBody] = useState('');
  const [othersTyping, setOthersTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagingApi.messages(id).then(setMessages);
    // Participants are the source of truth for the header: a brand-new thread
    // contains only the client's own opening message, so deriving the
    // counterpart from incoming messages alone would render a blank title.
    messagingApi.conversation(id).then(setConversation).catch(() => {});
    messagingApi.markRead(id).catch(() => {});

    const socket = getSocket();
    if (!socket) return;

    socket.emit('conversation:join', id);

    const onNewMessage = (message: any) => {
      if (message.conversationId !== id) return;
      setMessages((prev) => [...prev, message]);
    };
    const onTyping = (payload: { isTyping: boolean }) => setOthersTyping(payload.isTyping);

    socket.on('message:new', onNewMessage);
    socket.on('typing', onTyping);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing', onTyping);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function onTypingChange(value: string) {
    setBody(value);
    getSocket()?.emit('typing', { conversationId: id, isTyping: value.length > 0 });
  }

  async function send() {
    if (!body.trim()) return;
    const socket = getSocket();
    const text = body;
    setBody('');
    if (socket?.connected) {
      socket.emit('message:send', { conversationId: id, body: text });
    } else {
      const message = await messagingApi.send(id, text);
      setMessages((prev) => [...prev, message]);
    }
  }

  // Group into day blocks so long threads stay readable, and keep the
  // header label without a second network call — the counterpart is simply
  // whoever on the other side has sent a message.
  const days = useMemo(() => {
    const out: { label: string; items: any[] }[] = [];
    for (const m of messages) {
      const d = new Date(m.createdAt);
      const last = out[out.length - 1];
      if (last && sameDay(new Date(last.items[0].createdAt), d)) last.items.push(m);
      else out.push({ label: dayLabel(d), items: [m] });
    }
    return out;
  }, [messages]);

  const counterpart = useMemo(() => {
    // Prefer the participant record: it is correct even before the other side
    // has replied. Fall back to message senders for older threads.
    const participants = conversation?.participants ?? [];
    const otherParticipant =
      participants.find((p: any) => p?.provider?.user?.id && p.provider.user.id !== user?.id)?.provider ??
      participants.find((p: any) => p?.client?.user?.id && p.client.user.id !== user?.id)?.client;

    if (otherParticipant) {
      const profile = otherParticipant.user ?? {};
      const name =
        otherParticipant.businessName ??
        `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
      return { name: name || 'Conversation', avatarUrl: profile.avatarUrl };
    }

    const other = messages.find((m) => m?.sender?.id && m.sender.id !== user?.id)?.sender;
    if (!other) return null;
    const name = `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim();
    return { name: name || 'Conversation', avatarUrl: other.avatarUrl };
  }, [conversation, messages, user?.id]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-3xl flex-col px-4 py-4 md:h-[calc(100dvh-4rem)]">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <BackButton variant="icon" label="Back to conversations" fallbackHref="/messages" />
        {counterpart && (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-200">
              {counterpart.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={counterpart.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs font-bold text-ink-500" aria-hidden="true">
                  {counterpart.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <h1 className="truncate font-display text-base font-bold text-ink-950">
              {counterpart.name}
            </h1>
          </>
        )}
      </header>

      <div
        className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2"
        role="log"
        aria-live="polite"
        aria-label="Messages"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400">
            No messages yet. Say hello to get started.
          </p>
        ) : (
          days.map((day) => (
            <div key={day.label}>
              <div className="my-4 flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-ink-200" />
                <span className="text-2xs font-bold uppercase tracking-wider text-ink-400">
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-ink-200" />
              </div>

              <ul className="space-y-2.5">
                {day.items.map((m) => {
                  const mine = !!m?.sender?.id && m.sender.id === user?.id;
                  return (
                    <li
                      key={m.id}
                      className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!mine && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-200 text-2xs font-bold text-ink-500">
                          {m?.sender?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.sender.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            (m?.sender?.firstName ?? '?').charAt(0).toUpperCase()
                          )}
                        </span>
                      )}

                      <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                        {!mine && (
                          <span className="mb-1 px-1 text-2xs font-semibold text-ink-400">
                            {senderName(m, mine)}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                            mine
                              ? 'rounded-br-md bg-brand-600 text-white dark:text-home-night'
                              : 'rounded-bl-md bg-ink-100 text-ink-900'
                          }`}
                        >
                          {m.body}
                        </div>
                        <time
                          dateTime={m.createdAt}
                          className="mt-1 px-1 text-2xs text-ink-400"
                        >
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}

        {othersTyping && (
          <div className="flex items-end gap-2" role="status">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-200" aria-hidden="true" />
            <span className="rounded-2xl rounded-bl-md bg-ink-100 px-4 py-3">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-400"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
            </span>
            <span className="sr-only">Contact is typing</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="mt-3 flex shrink-0 items-end gap-2 border-t border-ink-200 pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <textarea
          id="message-body"
          rows={1}
          placeholder="Type a message…"
          className="max-h-32 min-h-[2.75rem] flex-1 resize-none py-2.5"
          value={body}
          onChange={(e) => onTypingChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" disabled={!body.trim()} className="btn-primary h-11 w-11 shrink-0 !px-0" aria-label="Send message">
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
