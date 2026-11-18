'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { BackButton, useCanGoBack } from '@/components/back-button';
import { useAuth, useSession } from '@/components/auth-provider';
import { useI18n } from '@/components/locale-provider';
import { NotificationBell } from '@/components/notification-bell';
import { ThemeSegmentedControl, ThemeToggle } from '@/components/theme-toggle';

type NavLink = { href: string; label: string; description?: string };

const GUEST_LINKS: NavLink[] = [
  { href: '/search', label: 'Find providers' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/register?role=provider', label: 'Become a provider' },
];

const MEMBER_LINKS: NavLink[] = [
  { href: '/search', label: 'Find providers' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/bookings', label: 'Bookings', description: 'Scheduled, active and completed work.' },
  { href: '/messages', label: 'Messages', description: 'Conversations with providers and clients.' },
];

function navLinks(isSignedIn: boolean) {
  return isSignedIn ? MEMBER_LINKS : GUEST_LINKS;
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isProvider, isAdmin } = useSession();
  const { translateMessage: tr } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const canGoBack = useCanGoBack();

  const links = navLinks(!!user);
  const close = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  const avatar = (user?.firstName?.trim().charAt(0) || user?.email.charAt(0) || 'U').toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-surface/90 backdrop-blur-xl supports-[backdrop-filter]:bg-surface/75">
        <div className="page-shell flex h-14 items-center gap-2 sm:h-16 sm:gap-3 lg:h-[4.5rem]">
          {canGoBack && (
            <>
              <BackButton variant="icon" label="Go back" className="-ml-1 shrink-0 sm:-ml-1.5" />
              <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-ink-200 sm:block" />
            </>
          )}
          <div className="min-w-0 shrink-0 sm:hidden">
            <BrandMark compact />
          </div>
          <div className="hidden min-w-0 shrink-0 sm:block">
            <BrandMark responsive />
          </div>

          <nav aria-label="Main" className="hidden items-center gap-1 lg:ml-4 lg:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={link.description}
                aria-current={isCurrent(link.href) ? 'page' : undefined}
                className={`relative rounded-lg px-3 py-2.5 text-sm font-semibold transition after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand-700 after:opacity-0 after:transition ${
                  isCurrent(link.href)
                    ? 'text-ink-950 after:opacity-100'
                    : 'text-ink-600 hover:bg-ink-100/60 hover:text-ink-950'
                }`}
              >
                {tr(link.label)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {user ? (
              <>
                <Link
                  href="/requests"
                  className="hidden text-sm font-semibold text-ink-600 transition hover:text-ink-950 md:inline"
                >
                  {tr('My requests')}
                </Link>
                {isProvider && (
                  <Link href="/dashboard" className="btn-secondary btn-sm hidden sm:inline-flex">
                    <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                    {tr('Dashboard')}
                  </Link>
                )}
                {isAdmin && (
                  <Link href="/admin" className="btn-secondary btn-sm hidden sm:inline-flex">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {tr('Admin')}
                  </Link>
                )}
                <NotificationBell />
                <Link
                  href="/account"
                  aria-current={pathname === '/account' ? 'page' : undefined}
                  aria-label={tr('Account')}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition sm:h-auto sm:w-auto sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2 sm:font-semibold ${
                    pathname === '/account'
                      ? 'bg-ink-100 text-ink-950 ring-2 ring-brand-600/20'
                      : 'text-ink-700 hover:bg-ink-100/70 hover:text-ink-950'
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-2xs font-bold uppercase text-white dark:text-home-night sm:h-6 sm:w-6">
                    {avatar}
                  </span>
                  <span className="hidden sm:inline">{tr('Account')}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="hidden rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-500 transition hover:bg-ink-100/70 hover:text-ink-950 md:block"
                >
                  {tr('Log out')}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-100/60 hover:text-ink-950 md:inline"
                >
                  {tr('Log in')}
                </Link>
                <Link
                  href="/register"
                  className="btn-primary h-9 rounded-full px-3.5 text-[13px] sm:h-10 sm:rounded-xl sm:px-4 sm:text-sm"
                >
                  {tr('Get started')}
                </Link>
              </>
            )}

            <div className="hidden sm:block">
              <ThemeToggle />
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="icon-btn h-9 w-9 rounded-full sm:h-9 sm:w-9 sm:rounded-xl lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={tr('Menu')}>
          <button
            type="button"
            className="absolute inset-0 bg-home-night/40 backdrop-blur-[2px] animate-fade-in"
            aria-label="Close menu"
            onClick={close}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-ink-200 bg-surface shadow-2xl animate-slide-up-sheet">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink-300" aria-hidden="true" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <p className="text-sm font-bold text-ink-950">{tr('Menu')}</p>
              <button type="button" onClick={close} className="icon-btn h-9 w-9 rounded-full" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <nav aria-label="Mobile" className="space-y-1">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={close}
                    aria-current={isCurrent(link.href) ? 'page' : undefined}
                    className={`flex min-h-12 items-center rounded-2xl px-4 py-3 text-[15px] font-semibold transition ${
                      isCurrent(link.href)
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-800 active:bg-ink-100'
                    }`}
                  >
                    <span>
                      <span className="block">{tr(link.label)}</span>
                      {link.description && (
                        <span className="mt-0.5 block text-xs font-normal text-ink-500">{tr(link.description)}</span>
                      )}
                    </span>
                  </Link>
                ))}
              </nav>

              <div className="mt-4 rounded-2xl border border-ink-200 bg-ink-50/60 p-3">
                <p className="mb-2 px-1 text-xs font-semibold text-ink-500">{tr('Appearance')}</p>
                <ThemeSegmentedControl />
              </div>

              <div className="mt-4 space-y-2 border-t border-ink-200/80 pt-4">
                {user ? (
                  <>
                    <Link href="/requests" onClick={close} className="btn-secondary w-full justify-center">
                      {tr('My requests')}
                    </Link>
                    <Link href="/account" onClick={close} className="btn-secondary w-full justify-center">
                      {tr('Account')}
                    </Link>
                    {isProvider && (
                      <Link href="/dashboard" onClick={close} className="btn-primary w-full">
                        <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> {tr('Dashboard')}
                      </Link>
                    )}
                    {isAdmin && (
                      <Link href="/admin" onClick={close} className="btn-primary w-full">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {tr('Admin')}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        void logout();
                      }}
                      className="btn-ghost w-full"
                    >
                      {tr('Log out')}
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={close} className="btn-secondary w-full">
                      {tr('Log in')}
                    </Link>
                    <Link href="/register" onClick={close} className="btn-primary w-full">
                      {tr('Get started')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
