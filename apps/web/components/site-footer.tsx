'use client';

import Link from 'next/link';
import { BadgeCheck, Quote, Wallet, ArrowUpRight } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useSession } from '@/components/auth-provider';

const EXPLORE_LINKS = [
  { href: '/search?q=Plumbing', label: 'Plumbing' },
  { href: '/search?q=Electrical', label: 'Electrical' },
  { href: '/search?q=Cleaning', label: 'Cleaning' },
  { href: '/search?q=Painting', label: 'Painting' },
  { href: '/search', label: 'All services' },
];

const PRODUCT_LINKS = [
  { href: '/search', label: 'Find a provider' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/compare', label: 'Compare quotes' },
  { href: '/saved-searches', label: 'Saved searches' },
  { href: '/#how-it-works', label: 'How it works' },
];

const TRUST = [
  { icon: BadgeCheck, label: 'Identity checks' },
  { icon: Quote, label: 'Structured quotes' },
  { icon: Wallet, label: 'Direct payment' },
];

export function SiteFooter() {
  const { isProvider } = useSession();

  return (
    <footer className="mt-8 border-t border-ink-200 bg-surface">
      <div className="page-shell grid gap-10 py-12 md:grid-cols-12 md:gap-8 md:py-16">
        <div className="md:col-span-4">
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
            Rwanda&rsquo;s marketplace for local services — search, compare structured quotes, book
            and review without handing your money to a middleman.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {TRUST.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-canvas/60 px-2.5 py-1 text-xs font-semibold text-ink-600"
              >
                <Icon className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-brand-700">
            Serving Kigali · Rubavu · Musanze · Huye
          </p>
        </div>

        <nav aria-label="Explore services" className="md:col-span-2">
          <p className="mb-4 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">Explore</p>
          <ul className="space-y-3 text-sm">
            {EXPLORE_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-ink-600 transition hover:text-brand-700">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Product" className="md:col-span-2">
          <p className="mb-4 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">Product</p>
          <ul className="space-y-3 text-sm">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-ink-600 transition hover:text-brand-700">
                  {link.label}
                </Link>
              </li>
            ))}
            {!isProvider && (
              <li>
                <Link href="/register" className="text-ink-600 transition hover:text-brand-700">
                  Become a provider
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <nav aria-label="For providers" className="md:col-span-2">
          <p className="mb-4 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">
            For providers
          </p>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/register" className="text-ink-600 transition hover:text-brand-700">
                List your services
              </Link>
            </li>
            <li>
              <Link
                href="/provider/onboarding"
                className="text-ink-600 transition hover:text-brand-700"
              >
                Onboarding
              </Link>
            </li>
            <li>
              <Link
                href="/provider/verification"
                className="text-ink-600 transition hover:text-brand-700"
              >
                Verification
              </Link>
            </li>
            <li>
              <Link
                href="/provider/analytics"
                className="text-ink-600 transition hover:text-brand-700"
              >
                Analytics
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Account" className="md:col-span-2">
          <p className="mb-4 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">Account</p>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/account" className="text-ink-600 transition hover:text-brand-700">
                Profile
              </Link>
            </li>
            <li>
              <Link href="/bookings" className="text-ink-600 transition hover:text-brand-700">
                Bookings
              </Link>
            </li>
            <li>
              <Link href="/messages" className="text-ink-600 transition hover:text-brand-700">
                Messages
              </Link>
            </li>
            <li>
              <Link href="/disputes" className="text-ink-600 transition hover:text-brand-700">
                Disputes
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-ink-600 transition hover:text-brand-700"
              >
                Log in <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-ink-100">
        <div className="page-shell flex flex-col items-start justify-between gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:items-center">
          <span>&copy; {new Date().getFullYear()} Bii Localfinder</span>
          <span>Built in Rwanda for trust, quotes and local work.</span>
        </div>
      </div>
    </footer>
  );
}
