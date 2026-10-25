'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronDown,
  FolderTree,
  ShieldCheck,
  Scale,
  Flag,
  SlidersHorizontal,
  LogOut,
  Menu,
  X,
  Users,
  History,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { RequireAdmin } from '@/components/require-admin';
import { BrandMark } from '@/components/brand-mark';
import { BackButton, useCanGoBack } from '@/components/back-button';
import { useAuth } from '@/components/auth-provider';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Admin shell.
 *
 * AppChrome treats /admin as an app-shell path (no site header), and until
 * this layout existed the moderation pages rendered with no chrome at all —
 * no way back to the marketplace, no way between queues, no sign-out. This
 * supplies that chrome, scoped to moderation only.
 */
const ADMIN_NAV: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Audit logs', href: '/admin/audit-logs', icon: History },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
  { label: 'Categories', href: '/admin/categories', icon: FolderTree },
  { label: 'Verifications', href: '/admin/verifications', icon: ShieldCheck },
  { label: 'Disputes', href: '/admin/disputes', icon: Scale },
  { label: 'Reports', href: '/admin/reports', icon: Flag },
  { label: 'Personalization', href: '/admin/personalization', icon: SlidersHorizontal },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAdmin>
      <AdminChrome>{children}</AdminChrome>
    </RequireAdmin>
  );
}

function AdminChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const canGoBack = useCanGoBack();

  const nav = (
    <nav aria-label="Admin navigation" className="flex items-center gap-0.5 overflow-x-auto">
      {ADMIN_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-brand-50 text-brand-800'
                : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-950'
            }`}
          >
            <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-surface/85 text-ink-900 backdrop-blur-xl">
        <div className="page-workspace">
          <div className="flex h-14 items-center gap-4">
            {canGoBack && (
              <>
                <BackButton variant="icon" label="Go back" className="-ml-1 hidden sm:inline-flex" />
                <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-ink-200 sm:block" />
              </>
            )}
            <BrandMark responsive />

            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-bold uppercase tracking-wider text-brand-700 sm:inline-flex">
              Admin
            </span>

            <div className="hidden min-w-0 flex-1 md:block">{nav}</div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                href="/"
                className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-600 transition hover:bg-ink-100/70 hover:text-ink-950 sm:inline-flex"
              >
                Marketplace
              </Link>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void logout()}
                className="btn-secondary btn-sm"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? 'Close admin navigation' : 'Open admin navigation'}
                aria-expanded={open}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-600 transition hover:bg-ink-100 md:hidden md:h-9 md:w-9"
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {open && (
            <div className="animate-fade-in border-t border-ink-200/80 py-2 md:hidden">
              {nav}
              <Link
                href="/"
                className="mt-1 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100/70 hover:text-ink-950 sm:hidden"
              >
                <ChevronDown className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
                Back to marketplace
              </Link>
            </div>
          )}
        </div>
      </header>

      {children}
    </div>
  );
}
