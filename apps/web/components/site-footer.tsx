'use client';

import Link from 'next/link';
import { ShieldCheck, Wallet, Quote, MessageCircle } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { useSession } from '@/components/auth-provider';

const PRODUCT_LINKS = [
  { href: '/search', label: 'Find a provider' },
  { href: '/requests/new', label: 'Post a request' },
  { href: '/compare', label: 'Compare quotes' },
  { href: '/saved-searches', label: 'Saved searches' },
];

const TRUST = [
  { icon: ShieldCheck, label: 'Identity-verified pros' },
  { icon: Quote, label: 'Structured, comparable quotes' },
  { icon: Wallet, label: 'No escrow, no middleman' },
  { icon: MessageCircle, label: 'In-app messaging' },
];

export function SiteFooter() {
  const { isProvider } = useSession();

  return (
    <footer className="mt-8 border-t border-ink-200 bg-surface">
      <div className="border-b border-ink-100">
        <div className="page-shell grid grid-cols-2 gap-x-6 gap-y-4 py-6 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm font-medium text-ink-600">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="page-shell grid gap-10 py-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <BrandMark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
            Rwanda&rsquo;s marketplace for verified local services — search, quote, book and review
            without handing your money to a middleman.
          </p>
          <p className="mt-6 text-xs font-bold uppercase tracking-wider text-brand-700">
            Serving Kigali · Rubavu · Musanze · Huye
          </p>
        </div>

        <nav aria-label="Product" className="md:col-span-3">
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
            <li>
              <Link href="/login" className="text-ink-600 transition hover:text-brand-700">
                Log in
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
          </ul>
        </nav>

        <nav aria-label="Providers" className="md:col-span-2">
          <p className="mb-4 text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">For providers</p>
          <ul className="space-y-3 text-sm">
            <li>
              <Link href="/register" className="text-ink-600 transition hover:text-brand-700">
                List your services
              </Link>
            </li>
            <li>
              <Link href="/provider/onboarding" className="text-ink-600 transition hover:text-brand-700">
                Onboarding
              </Link>
            </li>
            <li>
              <Link href="/provider/verification" className="text-ink-600 transition hover:text-brand-700">
                Verification
              </Link>
            </li>
            <li>
              <Link href="/provider/analytics" className="text-ink-600 transition hover:text-brand-700">
                Analytics
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-ink-100">
        <div className="page-shell flex flex-col items-start justify-between gap-2 py-6 text-xs text-ink-500 sm:flex-row sm:items-center">
          <span>&copy; {new Date().getFullYear()} Bii Localfinder</span>
          <span>Built for trust, quotes and local work.</span>
        </div>
      </div>
    </footer>
  );
}
