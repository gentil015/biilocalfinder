'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, Settings } from 'lucide-react';
import { notificationsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { EmptyState } from '@/components/ui/page';

export function NotificationBell() {
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

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
    const onNew = (notification: any) => {
      setItems((prev) => [notification, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
    };
    socket.on('notification:new', onNew);
    return () => {
      socket.off('notification:new', onNew);
    };
  }, []);

  async function openPanel() {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) {
      await notificationsApi.markAllRead();
      setUnreadCount(0);
    }
  }

  return (
    <div className="relative">
      <button
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
          className="animate-scale-in absolute right-0 z-40 mt-2 w-[20rem] origin-top-right overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-xl"
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
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3 transition-colors hover:bg-ink-50/70">
                  <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm leading-relaxed text-ink-500">{n.body}</p>}
                  <p className="tabular mt-1 text-2xs text-ink-400">
                    <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                  </p>
                </li>
              ))}
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
