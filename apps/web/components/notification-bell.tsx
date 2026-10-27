'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, Settings } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useSession } from '@/components/auth-provider';
import { EmptyState } from '@/components/ui/page';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

function stringData(item: NotificationItem, key: string): string | null {
  const value = item.data?.[key];
  return typeof value === 'string' ? value : null;
}

// Every notification already carries the identifier its destination needs
// (the API does the same mapping for email deep-links in
// notification-links.ts). Keep the client-side map here so an in-app
// notification is actually actionable instead of a dead line of text.
function notificationHref(item: NotificationItem, isProvider: boolean): string | null {
  const bookingId = stringData(item, 'bookingId');
  const requestId = stringData(item, 'requestId');
  const conversationId = stringData(item, 'conversationId');
  const disputeId = stringData(item, 'disputeId');
  const providerId = stringData(item, 'providerId');
  const savedSearchId = stringData(item, 'savedSearchId');

  switch (item.type) {
    case 'NEW_MESSAGE':
      return conversationId ? `/messages/${conversationId}` : null;
    case 'NEW_SERVICE_REQUEST':
      return requestId ? `/provider/requests/${requestId}` : null;
    case 'NEW_QUOTE':
    case 'QUOTE_ACCEPTED':
    case 'QUOTE_REJECTED':
    case 'QUOTE_UPDATED':
      if (bookingId) return `/bookings/${bookingId}`;
      if (requestId) return isProvider ? `/provider/requests/${requestId}` : `/requests/${requestId}`;
      return isProvider ? '/provider/requests' : '/requests';
    case 'BOOKING_CREATED':
    case 'BOOKING_UPDATED':
    case 'BOOKING_COMPLETED':
    case 'BOOKING_REMINDER':
      return bookingId ? `/bookings/${bookingId}` : null;
    case 'NEW_REVIEW':
      return '/provider/reviews';
    case 'REVIEW_RESPONSE':
      // The recipient is the client — the provider's public profile is the
      // only surface where they can see the reply and review context.
      return providerId ? `/providers/${providerId}` : null;
    case 'VERIFICATION_UPDATED':
    case 'VERIFICATION_EXPIRING':
      return '/provider/verification';
    case 'SUBSCRIPTION_EXPIRING':
    case 'SUBSCRIPTION_EXPIRED':
      return '/dashboard';
    case 'FAVORITE_PROVIDER_AVAILABLE':
      return providerId ? `/providers/${providerId}` : null;
    case 'NEW_PROVIDER_MATCH':
      return savedSearchId ? '/saved-searches' : null;
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESPONSE':
    case 'DISPUTE_UNDER_REVIEW':
    case 'DISPUTE_RESOLVED':
      return disputeId ? `/disputes/${disputeId}` : null;
    default:
      return null;
  }
}

export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' }) {
  const { isProvider } = useSession();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationsApi
      .list()
      .then((res) => {
        setItems(res.items);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => {
        /* not logged in — bell just stays empty */
      });

    const socket = getSocket();
    if (!socket) return;
    const onNew = (notification: NotificationItem) => {
      setItems((prev) => [notification, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, []);

  // Close on outside click / Escape so the popover behaves like a menu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function openPanel() {
    const opening = !open;
    setOpen(opening);
    if (opening && unreadCount > 0) {
      setUnreadCount(0);
      const readAt = new Date().toISOString();
      setItems((prev) => prev.map((item) => (item.readAt ? item : { ...item, readAt })));
      await notificationsApi.markAllRead().catch(() => {
        /* keep the badge cleared optimistically; next load re-syncs */
      });
    }
  }

  function markItemRead(item: NotificationItem) {
    if (item.readAt) return;
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(c - 1, 0));
    notificationsApi.markRead(item.id).catch(() => undefined);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={openPanel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="icon-btn relative h-9 w-9"
      >
        {unreadCount > 0 ? (
          <BellRing className="h-[18px] w-[18px] text-ink-900" aria-hidden="true" />
        ) : (
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        )}
        {unreadCount > 0 && (
          <span className="tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white dark:text-home-night ring-2 ring-surface">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Notifications"
          className={`animate-scale-in fixed inset-x-2 top-14 z-50 max-h-[70vh] overflow-auto rounded-xl border border-ink-200 bg-surface shadow-xl sm:absolute sm:inset-auto sm:top-auto sm:mt-2 sm:w-[22rem] sm:max-h-[70vh] ${
            align === 'left' ? 'sm:left-0 sm:origin-top-left' : 'sm:right-0 sm:origin-top-right'
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
            <p className="eyebrow-muted">Notifications</p>
            {items.length > 0 && (
              <span className="tabular text-2xs font-semibold text-ink-400">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications yet." className="border-0 px-4 py-10" />
          ) : (
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((n) => {
                const href = notificationHref(n, isProvider);
                const content = (
                  <>
                    <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{n.body}</p>}
                    <p className="tabular mt-1 text-2xs text-ink-400">
                      <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                    </p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          markItemRead(n);
                          setOpen(false);
                        }}
                        className={`block px-4 py-3 transition-colors hover:bg-ink-50/70 ${
                          n.readAt ? '' : 'bg-brand-50/40'
                        }`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className={`px-4 py-3 ${n.readAt ? '' : 'bg-brand-50/40'}`}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-ink-200 p-1.5">
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-ink-600 transition hover:bg-ink-50 hover:text-ink-950"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Notification settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
