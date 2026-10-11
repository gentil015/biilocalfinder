'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ClipboardList, MessageCircle, UserRound } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

const TABS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Requests', href: '/requests', icon: ClipboardList },
  { label: 'Messages', href: '/messages', icon: MessageCircle },
  // Clients have no workspace, so this must NOT point at /dashboard for
  // everyone logged in — /account works for every role.
  { label: 'Account', href: '/login', icon: UserRound, authHref: '/account' },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav
      aria-label="Primary"
      // env(safe-area-inset-bottom) keeps the bar clear of the iOS home
      // indicator; the AppChrome wrapper reserves the matching padding.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
        {TABS.map((tab) => {
          const href = tab.authHref && user ? tab.authHref : tab.href;
          const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-[60px] flex-1 flex-col items-center gap-1 px-1 py-2 text-[11px] font-semibold transition ${
                active ? 'text-brand-700' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                  active ? 'bg-brand-50' : ''
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 2} />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
