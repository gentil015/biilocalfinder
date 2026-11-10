'use client';

import { useI18n } from '@/components/locale-provider';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessagesSquare, Search } from 'lucide-react';
import { messagingApi } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function ConversationsPage() {
  const { translateMessage: tr } = useI18n();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    messagingApi
      .conversations()
      .then(setConversations)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow={tr('Inbox')}
        title={tr('Messages')}
        description={tr('Chats with providers, whether you messaged them directly or started with a service request.')}
      />

      {loading && <LoadingBlock label={tr('Loading your inbox…')} />}

      {!loading && conversations.length === 0 && (
        <EmptyState
          icon={MessagesSquare}
          title={tr('No conversations yet')}
          body={tr('Message a provider from their profile, or post a request and let them reply.')}
          action={
            <Link href="/requests/new" className="btn-primary btn-sm">
              {tr('Post a request')}
            </Link>
          }
        />
      )}

      <ul className="surface-card divide-y divide-ink-100 overflow-hidden">
        {conversations.map((c) => {
          const other = c.participants?.find((p: any) => p.provider || p.client);
          const name =
            other?.provider?.businessName ??
            `${other?.client?.user?.firstName ?? ''} ${other?.client?.user?.lastName ?? ''}`;
          const lastMessage = c.messages?.[0];
          const initial = name.trim().charAt(0).toUpperCase() || '?';
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3.5 p-4 transition hover:bg-ink-50/70 sm:px-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-sm font-extrabold text-white dark:text-home-night">
                  {initial}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-950">{name.trim() || tr('Conversation')}</p>
                  {lastMessage ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-ink-500">
                      {lastMessage.body?.trim() ||
                        (lastMessage.attachments?.length
                          ? lastMessage.attachments[0].mimeType?.startsWith('video/')
                            ? tr('Video')
                            : lastMessage.attachments[0].mimeType?.startsWith('audio/')
                              ? tr('Voice note')
                              : tr('Photo')
                          : tr('No messages yet'))}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-ink-400">{tr('No messages yet')}</p>
                  )}
                </div>

                {c.serviceRequest?.title && (
                  <span className="hidden max-w-[40%] truncate rounded-full bg-ink-100 px-2.5 py-1 text-2xs font-semibold text-ink-600 sm:block">
                    {c.serviceRequest.title}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {!loading && conversations.length > 0 && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          {tr('Looking for something specific? Search providers to start a new thread.')}
        </p>
      )}
    </main>
  );
}
