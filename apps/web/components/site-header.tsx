'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, Plus, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { BackButton, useCanGoBack } from '@/components/back-button';
import { useAuth, useSession } from '@/components/auth-provider';
import { ThemeSegmentedControl, ThemeToggle } from '@/components/theme-toggle';

type NavLink = { href: string; label: string; description?: string };

// Visitors get the marketing nav: the pitch, how it works, and the
// "Become a provider" acquisition CTA (which opens the public /register form).
const GUEST_LINKS: NavLink[] = [
  { href: '/search', label: 'Find providers' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/register', label: 'Become a provider' },
];

// Signed-in users are past the pitch, so "How it works" and "Become a
// provider" give way to the two things they actually come back for — their
// bookings and their conversations. "Become a provider" still lives in the
// footer and on /account for clients who want to upgrade.
const MEMBER_LINKS: NavLink[] = [
  { href: '/search', label: 'Find providers' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/bookings', label: 'Bookings', description: 'Scheduled, active and completed work.' },
  { href: '/messages', label: 'Messages', description: 'Conversations with providers and clients.' },
];

function navLinks(isSignedIn: boolean) {
  return isSignedIn ? MEMBER_LINKS : GUEST_LINKS;
}

/**
 * The site header.
 *
 * A frosted bar that sits above the page on every marketplace route —
 * translucent surface over the near-white canvas (near-black in dark mode,
 * since the fill is the `surface` token), so the content below is the hero and
 * the chrome stays out of the way. The brand green is the single call to
 * action; everything else is a quiet neutral link. The theme switcher lives
 * here because it is chrome-level: available on every route, for guests and
 * members alike, in the same place.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isProvider, isAdmin } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // A back affordance appears once the user has moved within the app, so a
  // shared link or a fresh tab doesn't offer to walk them out of the product.
  const canGoBack = useCanGoBack();

  const links = navLinks(!!user);
  const close = () => setMenuOpen(false);

  // A link to the page you're already on shouldn't read as a nav item.
  const isCurrent = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-surface/85 backdrop-blur-xl">
      <div className="page-shell flex h-16 items-center gap-3 sm:gap-4 lg:h-[4.5rem]">
        {canGoBack && (
          <>
            <BackButton variant="icon" label="Go back" className="-ml-1.5 hidden sm:inline-flex" />
            <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-ink-200 sm:block" />
          </>
        )}
        <BrandMark responsive />

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
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              <Link
                href="/requests"
                className="hidden text-sm font-semibold text-ink-600 transition hover:text-ink-950 md:inline"
              >
                My requests
              </Link>
              {/* Only providers have a workspace; sending a client here used to
                  bounce them through onboarding into a 403. */}
              {isProvider && (
                <Link href="/dashboard" className="btn-secondary btn-sm hidden sm:inline-flex">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  Dashboard
                </Link>
              )}
              {/* Moderators have no workspace, so they get no Dashboard link —
                  but they need a way into the moderation queues from the
                  marketplace chrome, not only via /admin. */}
              {isAdmin && (
                <Link href="/admin" className="btn-secondary btn-sm hidden sm:inline-flex">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                aria-current={pathname === '/account' ? 'page' : undefined}
                className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${
                  pathname === '/account'
                    ? 'bg-ink-100 text-ink-950'
                    : 'text-ink-700 hover:bg-ink-100/70 hover:text-ink-950'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-2xs font-bold uppercase text-white dark:text-home-night">
                  {(user.firstName?.trim().charAt(0) || user.email.charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="hidden sm:inline">Account</span>
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="hidden rounded-lg px-2.5 py-2 text-sm font-semibold text-ink-500 transition hover:bg-ink-100/70 hover:text-ink-950 md:block"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-100/60 hover:text-ink-950 md:inline"
              >
                Log in
              </Link>
              <Link href="/register" className="btn-primary h-10 px-3.5 text-sm sm:px-4">
                Get started
              </Link>
            </>
          )}

          {/* Theme first on small screens too: it sits left of the menu
              button, so it is reachable whether or not the sheet is open. */}
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="icon-btn lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet. Rendered inside the header so it inherits the sticky
          stacking context and the backdrop blur. */}
      {menuOpen && (
        <div className="animate-scale-in border-t border-ink-200/80 bg-surface/95 backdrop-blur-xl lg:hidden">
          <div className="page-shell py-4">
            <nav aria-label="Mobile" className="space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={close}
                  aria-current={isCurrent(link.href) ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    isCurrent(link.href)
                      ? 'bg-brand-50 text-brand-800'
                      : 'text-ink-700 hover:bg-ink-100/70 hover:text-ink-950'
                  }`}
                >
                  <span className="block">{link.label}</span>
                  {link.description && (
                    <span className="mt-0.5 block text-xs font-normal text-ink-500">
                      {link.description}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Theme, as a segmented control: the sheet is a full-width list,
                so three visible options beat a popover inside a popover. */}
            <div className="mt-3 border-t border-ink-200/80 pt-4">
              <ThemeSegmentedControl />
            </div>

            <div className="mt-3 space-y-2 border-t border-ink-200/80 pt-4">
              {user ? (
                <>
                  <Link href="/requests" onClick={close} className="btn-secondary w-full justify-start">
                    My requests
                  </Link>
                  <Link href="/account" onClick={close} className="btn-secondary w-full justify-start">
                    Account
                  </Link>
                  {isProvider && (
                    <Link href="/dashboard" onClick={close} className="btn-primary w-full">
                      <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
                    </Link>
                  )}
                  {isAdmin && (
                    <Link href="/admin" onClick={close} className="btn-primary w-full">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Admin
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
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={close} className="btn-secondary w-full">
                    Log in
                  </Link>
                  <Link href="/register" onClick={close} className="btn-primary w-full">
                    <Plus className="h-4 w-4" /> Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
