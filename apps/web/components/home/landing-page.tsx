'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Wrench,
  Zap,
  Sparkles,
  Paintbrush,
  Car,
  Laptop,
  Camera,
  ShieldCheck,
  Search,
  MapPin,
  ArrowRight,
  Quote,
  BadgeCheck,
  Wallet,
  MessageCircle,
  Star,
  Clock3,
  ChevronDown,
  Bot,
  Languages,
  CheckCircle2,
  Send,
  FileText,
  Users,
  CalendarCheck,
  ArrowUpRight,
  type LucideIcon,
} from 'lucide-react';
import { searchApi, servicesApi, type ProviderSearchItem } from '@/lib/api';
import { HomeSearch } from '@/components/home/home-search';
import { Reveal } from '@/components/home/reveal';
import { ProviderCard } from '@/components/provider-card';
import { ProviderCardSkeleton } from '@/components/provider-card-skeleton';
import { VerificationBadge } from '@/components/verification-badge';

const CATEGORIES: { name: string; hint: string; icon: LucideIcon }[] = [
  { name: 'Plumbing', hint: 'Leaks, fittings, tanks', icon: Wrench },
  { name: 'Electrical', hint: 'Wiring, meters, solar', icon: Zap },
  { name: 'Cleaning', hint: 'Homes and offices', icon: Sparkles },
  { name: 'Painting', hint: 'Interiors and exteriors', icon: Paintbrush },
  { name: 'Auto repair', hint: 'Service and diagnostics', icon: Car },
  { name: 'Tech & software', hint: 'Build, fix, automate', icon: Laptop },
  { name: 'Photography', hint: 'Events and portraits', icon: Camera },
];

const VALUE_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BadgeCheck,
    title: 'Identity checks',
    body: 'Providers can pass a live identity check before carrying the verified badge.',
  },
  {
    icon: Quote,
    title: 'Structured quotes',
    body: 'Scope, price and timing arrive in one comparable thread — not a vague chat.',
  },
  {
    icon: Star,
    title: 'Reviews from real jobs',
    body: 'Reviews are tied to completed bookings, so ratings reflect work that happened.',
  },
  {
    icon: Wallet,
    title: 'You pay the provider',
    body: 'No escrow and no middleman. Settle the work directly when it is done.',
  },
];

const HOW_IT_WORKS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Search,
    title: 'Find the right pro',
    body: 'Search by service and location, then browse real profiles, prices and availability.',
  },
  {
    icon: Quote,
    title: 'Compare clear quotes',
    body: 'Post a request and receive structured quotes with scope, price and timing side by side.',
  },
  {
    icon: CalendarCheck,
    title: 'Book and review',
    body: 'Confirm the details, get the work done, then leave a review from your completed booking.',
  },
];

const TRUST_FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BadgeCheck,
    title: 'Verification you can see',
    body: 'Identity checks appear as a badge on profiles and search results. Business verification is a separate, optional badge.',
  },
  {
    icon: Quote,
    title: 'The whole job, in writing',
    body: 'Price, materials, inclusions and exclusions stay attached to the request, so nothing important lives only in a chat.',
  },
  {
    icon: MessageCircle,
    title: 'Direct communication',
    body: 'Message providers in-app and keep the conversation, quote and booking in one place.',
  },
  {
    icon: ShieldCheck,
    title: 'A path when things go wrong',
    body: 'Either side can open a dispute, attach evidence and have an admin review it to a resolution.',
  },
];

const AI_BULLETS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Bot,
    title: 'A sentence becomes a request',
    body: 'Describe the job in plain language — the assistant drafts the title, description and category answers.',
  },
  {
    icon: Languages,
    title: 'English, Kinyarwanda or Français',
    body: 'Write in the language you think in. The drafted request follows the language you used.',
  },
  {
    icon: CheckCircle2,
    title: 'You stay in control',
    body: 'Nothing is submitted for you. Every field stays editable and you press “Send request” yourself.',
  },
];

const PROVIDER_BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Users,
    title: 'A profile that shows your work',
    body: 'Present your services, portfolio, coverage area and availability in one place.',
  },
  {
    icon: FileText,
    title: 'Structured requests',
    body: 'Clients describe the job with the details that matter, so you can quote with confidence.',
  },
  {
    icon: BadgeCheck,
    title: 'Trust you can build on',
    body: 'Earn a verification badge and collect reviews tied to completed bookings.',
  },
];

const FAQS = [
  {
    q: 'How is this different from listing in a directory?',
    a: 'A directory shows a name and a phone number. Here providers can clear an identity check before they appear as trusted, quotes come back structured on one thread instead of drifting through private chats, and a booking is what unlocks a review — so the rating you see is tied to work that actually happened.',
  },
  {
    q: 'Who pays whom — and is there an escrow?',
    a: 'There is no escrow and no platform payment for the service. Clients and providers settle the work directly, however they agree. The only payment Bii Localfinder ever handles is the optional provider subscription; the service itself has a 0% fee by design.',
  },
  {
    q: 'Am I charged anything to post a request or see quotes?',
    a: 'No. Searching, posting a service request and comparing quotes are free for clients. You only ever pay the provider you hire, for the work they do.',
  },
  {
    q: 'What counts as a “verified” provider?',
    a: 'A provider earns the badge by passing a live identity check and confirming a phone number with a one-time code. Business verification is a separate optional badge. Verified providers are surfaced first in search results.',
  },
  {
    q: 'Can the assistant really write my request?',
    a: 'The booking assistant turns a sentence into a structured request — title, description, dates, budget and the category-specific answers — in English, Kinyarwanda or French. It never submits anything; you review and edit every field first.',
  },
  {
    q: 'What if the job goes wrong?',
    a: 'Every booking has a reporting path: either side can open a dispute, attach evidence and message from one thread, and an admin moderator reviews it to a resolution. Your payment, though, is still settled directly with the provider.',
  },
];

function SectionIntro({
  eyebrow,
  title,
  body,
  link,
  center = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  link?: { href: string; label: string };
  center?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${center ? 'text-center md:text-left' : ''}`}
    >
      <div className={`max-w-2xl ${center ? 'mx-auto md:mx-0' : ''}`}>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950 sm:text-4xl">
          {title}
        </h2>
        {body && <p className="mt-3 text-sm leading-relaxed text-ink-600 sm:text-base">{body}</p>}
      </div>
      {link && (
        <Link
          href={link.href}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-brand-700 underline-offset-4 hover:underline"
        >
          {link.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/**
 * The hero's visual: an abstract coverage map, not a screenshot and not a
 * fabricated testimonial. A real provider card is overlaid when the public
 * search API returns one; otherwise the card simply explains a capability, so
 * the page never invents a name, rating or price.
 */
function HeroVisual({
  providers,
}: {
  providers: ProviderSearchItem[] | null;
}) {
  const spotlight = providers && providers.length > 0 ? providers[0] : null;
  const loading = providers === null;

  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-ink-200/80 bg-gradient-to-br from-brand-50 via-surface to-home-sand shadow-lift sm:min-h-[480px] lg:min-h-[560px]">
        {/* Abstract map: roads, blocks and pins. Decorative only. */}
        <svg
          viewBox="0 0 420 560"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <pattern id="landing-map-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#7F9084" opacity="0.28" />
            </pattern>
            <linearGradient id="landing-map-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect width="420" height="560" fill="url(#landing-map-dots)" />

          {/* Blocks */}
          <path d="M24 44h108v88H24z" fill="#FFFFFF" opacity="0.5" />
          <path d="M286 52h108v96H286z" fill="#FFFFFF" opacity="0.45" />
          <path d="M38 342h120v108H38z" fill="#FFFFFF" opacity="0.4" />
          <path d="M272 392h112v92H272z" fill="#FFFFFF" opacity="0.5" />

          {/* Roads */}
          <path
            d="M-30 150C70 128 132 196 214 186S344 128 456 166"
            stroke="#FFFFFF"
            strokeWidth="22"
            strokeLinecap="round"
          />
          <path
            d="M-30 150C70 128 132 196 214 186S344 128 456 166"
            stroke="#A7F3C2"
            strokeWidth="2"
            strokeDasharray="8 14"
            opacity="0.8"
          />
          <path
            d="M112 -40C132 110 96 230 168 330S284 458 268 600"
            stroke="#FFFFFF"
            strokeWidth="18"
            strokeLinecap="round"
          />
          <path
            d="M112 -40C132 110 96 230 168 330S284 458 268 600"
            stroke="#A7F3C2"
            strokeWidth="2"
            strokeDasharray="8 14"
            opacity="0.65"
          />
          <path
            d="M-30 420C80 398 150 452 230 430S360 386 456 414"
            stroke="#FFFFFF"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* Coverage ring */}
          <circle cx="222" cy="300" r="94" fill="#166534" opacity="0.05" />
          <circle cx="222" cy="300" r="94" stroke="#166534" strokeOpacity="0.14" strokeDasharray="4 8" />

          {/* Pins (service types, not data) */}
          <g transform="translate(124 198)">
            <circle r="26" fill="#166534" opacity="0.10" />
            <path
              d="M0 20s13-9.7 13-20a13 13 0 1 0-26 0C-13 10.3 0 20 0 20Z"
              fill="#166534"
            />
            <circle cy="-9" r="4.6" fill="#FFFFFF" />
          </g>
          <g transform="translate(296 246)">
            <circle r="22" fill="#166534" opacity="0.08" />
            <path
              d="M0 17s11-8.2 11-17a11 11 0 1 0-22 0C-11 8.8 0 17 0 17Z"
              fill="#22C55E"
            />
            <circle cy="-7.6" r="3.9" fill="#FFFFFF" />
          </g>
          <g transform="translate(196 398)">
            <circle r="20" fill="#86EFAC" opacity="0.22" />
            <path
              d="M0 15s10-7.5 10-15.4A10 10 0 1 0-10-.4C-10 7.5 0 15 0 15Z"
              fill="#4ADE80"
            />
            <circle cy="-6.9" r="3.5" fill="#FFFFFF" />
          </g>

          <rect width="420" height="560" fill="url(#landing-map-fade)" />
        </svg>

        {/* Location label on the map */}
        <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-ink-200/80 bg-surface/90 px-3 py-1.5 text-xs font-bold text-ink-700 shadow-xs backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
          Kigali and beyond
        </div>

        <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/95 px-3 py-1.5 text-xs font-bold text-brand-800 shadow-xs backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Identity checks
        </div>

        {/* Floating real-provider card */}
        <div className="absolute inset-x-5 bottom-5 sm:inset-x-6 sm:bottom-6">
          {loading ? (
            <div className="rounded-2xl border border-ink-200 bg-surface/95 p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="skeleton h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            </div>
          ) : spotlight ? (
            <Link
              href={`/providers/${spotlight.id}`}
              className="group block rounded-2xl border border-ink-200/90 bg-surface/95 p-4 shadow-lg backdrop-blur transition hover:border-brand-300 hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 ring-1 ring-inset ring-black/5">
                  {spotlight.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={spotlight.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-lg font-extrabold text-white dark:text-home-night">
                      {(spotlight.businessName?.charAt(0) || 'P').toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-ink-950">{spotlight.businessName}</p>
                    <VerificationBadge
                      status={spotlight.verificationStatus}
                      businessVerified={spotlight.businessVerified}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                    {spotlight.reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-ink-700">
                        <Star className="h-3.5 w-3.5 fill-rating-400 text-rating-400" aria-hidden="true" />
                        {spotlight.rating.toFixed(1)}
                        <span className="font-normal text-ink-400">({spotlight.reviewCount})</span>
                      </span>
                    ) : (
                      <span>New on BII</span>
                    )}
                    {spotlight.yearsOfExperience > 0 && (
                      <span className="truncate">· {spotlight.yearsOfExperience} yrs experience</span>
                    )}
                  </div>
                </div>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-ink-400 transition group-hover:text-brand-700"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
                <span className="text-xs font-semibold text-ink-500">A real provider on BII</span>
                <span className="text-sm font-bold tabular text-ink-950">
                  {spotlight.startingPrice != null ? (
                    <>
                      <span className="text-xs font-medium text-ink-400">from </span>
                      {spotlight.startingPrice.toLocaleString()}{' '}
                      <span className="text-xs font-semibold text-ink-500">{spotlight.currency}</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-ink-500">Contact for pricing</span>
                  )}
                </span>
              </div>
            </Link>
          ) : (
            <div className="rounded-2xl border border-ink-200/90 bg-surface/95 p-4 shadow-lg backdrop-blur">
              <p className="text-sm font-bold text-ink-950">Structured from the first message</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Describe the job once. Quotes come back with scope, price and timing in the same
                thread.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-3 text-center">
                {['Scope', 'Price', 'Timing'].map((label) => (
                  <span key={label} className="rounded-lg bg-ink-50 px-2 py-1.5 text-2xs font-bold uppercase tracking-wide text-ink-500">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [popular, setPopular] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderSearchItem[] | null>(null);

  useEffect(() => {
    servicesApi
      .list()
      .then((list: any[]) => setPopular(list.slice(0, 8).map((s) => s.name)))
      .catch(() =>
        setPopular([
          'Plumbing',
          'Electrical',
          'Cleaning',
          'Painting',
          'Auto repair',
          'Photography',
          'Wedding planning',
          'Pest control',
        ]),
      );

    // Same public endpoint the search page uses. A landing page that shows
    // real profiles is more useful than one that shows a decorative mock —
    // and it can never claim a rating that doesn't exist.
    searchApi
      .providers({ sort: 'highest_rated', limit: 6 })
      .then((res) => setProviders(res.items))
      .catch(() => setProviders([]));
  }, []);

  return (
    <main className="bg-canvas text-ink-900">
      {/* ------------------------------------------------------------------
          Hero — light, spacious and built around the search. The only dark
          surfaces on this page are deliberate focal bands further down.
          ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 60% 55% at 12% 0%, rgb(160 207 194 / 0.35), transparent 60%), radial-gradient(ellipse 45% 45% at 92% 8%, rgb(228 181 106 / 0.18), transparent 62%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent"
          aria-hidden="true"
        />

        <div className="page-shell grid items-center gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-6 xl:col-span-6">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-surface/80 px-3 py-1.5 text-2xs font-bold uppercase tracking-[0.16em] text-brand-800 shadow-xs backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-600" />
                </span>
                Rwanda&apos;s local services marketplace
              </p>

              <h1 className="mt-6 max-w-[16ch] font-display text-[38px] font-extrabold leading-[1.03] tracking-[-0.035em] text-ink-950 sm:text-5xl lg:text-[58px]">
                Find the right professional.{' '}
                <span className="relative whitespace-nowrap">
                  <span className="relative z-10 text-brand-700">Right around you.</span>
                  <svg
                    className="absolute -bottom-1 left-0 z-0 h-2.5 w-full text-brand-500/60"
                    viewBox="0 0 240 12"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M2 8.5C52 3.2 144 1.6 238 6.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" />
                  </svg>
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-600 sm:text-lg">
                Discover trusted local professionals, compare clear quotes, and connect with
                people who can get the job done — without paying a middleman.
              </p>

              <div className="mt-8">
                <HomeSearch tone="light" suggestions={popular} />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <Link href="/requests/new" className="btn-link">
                  Post a request <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <span aria-hidden="true" className="hidden h-4 w-px bg-ink-200 sm:block" />
                <Link href="/register" className="inline-flex items-center gap-1.5 font-semibold text-ink-600 hover:text-ink-950">
                  Have a service to offer? <span className="text-brand-700">Become a provider</span>
                </Link>
              </div>

              <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                  Free to search and post
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                  Pay the provider directly
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                  Kigali · Rubavu · Musanze · Huye
                </span>
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-6">
            <Reveal delay={100} className="h-full">
              <HeroVisual providers={providers} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trust strip — capabilities, not invented statistics. */}
      <section aria-label="Why BII Localfinder" className="border-y border-ink-200/80 bg-surface">
        <div className="page-shell grid grid-cols-1 gap-5 py-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {VALUE_POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink-950">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Categories — the fastest route from "I need something" to results.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-14 sm:py-16 lg:py-20">
        <Reveal>
          <SectionIntro
            eyebrow="Explore services"
            title="Start with the job, not a pitch."
            body="Pick a service to see real providers, compare their profiles and check who is available near you."
            link={{ href: '/search', label: 'Browse all providers' }}
          />
        </Reveal>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map(({ name, hint, icon: Icon }, i) => (
            <Reveal key={name} delay={i * 40}>
              <Link
                href={`/search?q=${encodeURIComponent(name)}`}
                className="group flex h-full flex-col rounded-2xl border border-ink-200 bg-surface p-4 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md sm:p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-700 group-hover:text-white dark:group-hover:text-home-night">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-3 flex items-start justify-between gap-2">
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-ink-950">
                    {name}
                  </span>
                  <ArrowUpRight
                    className="mt-0.5 h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-700"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1 text-xs leading-relaxed text-ink-500">{hint}</span>
              </Link>
            </Reveal>
          ))}

          <Reveal delay={CATEGORIES.length * 40}>
            <Link
              href="/search"
              className="group flex h-full flex-col justify-between rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50 sm:p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-brand-700 shadow-xs">
                <Search className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="mt-3 flex items-center justify-between gap-2 font-display text-[15px] font-extrabold tracking-tight text-brand-800">
                  See all services
                  <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-brand-800/70">
                  Search the whole marketplace
                </span>
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Real provider discovery. Nothing here is hardcoded: names, ratings,
          verification and prices all come from the public search API.
          ------------------------------------------------------------------ */}
      <section className="border-y border-ink-200/80 bg-home-mist">
        <div className="page-shell py-14 sm:py-16 lg:py-20">
          <Reveal>
            <SectionIntro
              eyebrow="Local professionals"
              title="Meet a few of the people on BII."
              body="Real profiles from the marketplace, including their ratings, verification and starting prices where providers have published them."
              link={{ href: '/search', label: 'See everyone' }}
            />
          </Reveal>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers === null ? (
              <>
                <ProviderCardSkeleton />
                <ProviderCardSkeleton />
                <ProviderCardSkeleton />
              </>
            ) : providers.length > 0 ? (
              providers.slice(0, 6).map((provider, i) => (
                <Reveal key={provider.id} delay={Math.min(i, 5) * 40}>
                  <ProviderCard provider={provider} />
                </Reveal>
              ))
            ) : (
              <div className="empty-state sm:col-span-2 lg:col-span-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 font-display text-lg font-extrabold text-ink-950">
                  Providers are joining the marketplace
                </p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-500">
                  No public profiles are available yet. You can still post a request, or be one of
                  the first providers in your area.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Link href="/requests/new" className="btn-primary">
                    Post a request
                  </Link>
                  <Link href="/register" className="btn-secondary">
                    Become a provider
                  </Link>
                </div>
              </div>
            )}
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-xs text-ink-500">
            <Star className="h-3.5 w-3.5 fill-rating-400 text-rating-400" aria-hidden="true" />
            Ratings come from completed bookings. Providers without reviews are shown as new.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          How it works.
          ------------------------------------------------------------------ */}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="page-shell py-14 sm:py-16 lg:py-24">
          <Reveal>
            <SectionIntro
              eyebrow="How it works"
              title="Three clear steps to get the job done."
              body="No account maze, no mystery fees, and no payment held by the platform."
            />
          </Reveal>

          <ol className="relative mt-10 grid gap-6 md:grid-cols-3 md:gap-8">
            <span
              className="pointer-events-none absolute left-[16%] right-[16%] top-6 hidden h-px bg-ink-200 md:block"
              aria-hidden="true"
            />
            {HOW_IT_WORKS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative">
                  <Reveal delay={i * 80}>
                    <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-ink-200 bg-surface font-display text-base font-extrabold text-brand-700 shadow-xs">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="mt-5 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
                      <h3 className="font-display text-lg font-extrabold tracking-tight text-ink-950">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Trust layer. Light cards, real capability statements.
          ------------------------------------------------------------------ */}
      <section className="bg-home-sand">
        <div className="page-shell py-14 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-12">
            <div className="lg:col-span-5">
              <Reveal>
                <p className="eyebrow">Trust layer</p>
                <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Built on verification, not promises.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-600 sm:text-base">
                  Choosing someone to work in your home or on your car is a trust decision. BII
                  gives you verification signals, written quotes and a clear record of the job.
                </p>
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-ink-200 bg-surface/80 p-3 text-xs leading-relaxed text-ink-500">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  Payment for the service happens directly between you and the provider. The
                  platform never holds your money.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href="/register" className="btn-primary">
                    Create a free account <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/search" className="btn-secondary">
                    Browse providers
                  </Link>
                </div>
              </Reveal>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
              {TRUST_FEATURES.map(({ icon: Icon, title, body }, i) => (
                <li key={title}>
                  <Reveal delay={i * 60} className="h-full">
                    <div className="h-full rounded-2xl border border-ink-200 bg-surface p-5 shadow-xs transition hover:border-brand-300 hover:shadow-card">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="mt-4 font-display text-base font-extrabold tracking-tight text-ink-950">
                        {title}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          AI assistant — an existing product capability, shown as a preview.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-14 sm:py-16 lg:py-20">
        <div className="overflow-hidden rounded-3xl border border-ink-200 bg-surface shadow-card">
          <div className="grid gap-10 p-6 sm:p-8 md:p-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <Reveal>
                <p className="eyebrow">AI-assist</p>
                <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Describe the job. We draft the request.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-600 sm:text-base">
                  Skip the blank form. Say what is wrong in a sentence and the assistant turns it
                  into a structured request with the right category answers — then you review it
                  before it goes to providers.
                </p>
                <ul className="mt-7 space-y-4">
                  {AI_BULLETS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-ink-950">{title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-600">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <Link href="/requests/new" className="btn-primary">
                    Try it with a request <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </div>

            <div className="lg:col-span-6">
              <Reveal delay={100} className="h-full">
                <div className="flex h-full min-h-[360px] flex-col justify-between rounded-2xl bg-home-night p-5 text-white sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-home-forest ring-1 ring-home-mint/40">
                        <Bot className="h-4 w-4 text-home-mint" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-bold">Booking assistant</p>
                        <p className="text-xs text-white/45">English · Kinyarwanda · Français</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-white/15 px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-white/50">
                      Preview
                    </span>
                  </div>

                  <div className="space-y-3 py-6">
                    <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-home-forest px-4 py-2.5 text-sm text-white/85">
                      I need a plumber to fix a leaking kitchen sink in Kimihurura, this Friday if
                      possible.
                    </p>
                    <p className="max-w-[92%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white/80">
                      Got it — a leaking kitchen sink in Kimihurura. I&apos;ve drafted the request.
                      What time works, and is there a budget in mind?
                    </p>
                    <div className="max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                      <p className="text-xs font-bold text-home-mint">Drafted request</p>
                      <p className="mt-1.5 text-sm font-bold">Kitchen sink leak repair</p>
                      <p className="mt-0.5 text-xs text-white/55">
                        Plumbing · Kimihurura · Preferred date: Friday
                      </p>
                      <span className="mt-2.5 inline-flex rounded-full bg-home-mint/20 px-2.5 py-1 text-2xs font-bold text-home-mint">
                        You review before sending
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-white/10 pt-4">
                    <p className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white/50">
                      Friday morning, around 9…
                    </p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-home-mint text-home-night">
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Provider conversion — the page's one deep focal band.
          ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-home-forest text-white">
        <div className="pointer-events-none absolute inset-0 bg-home-aurora opacity-70" aria-hidden="true" />
        <div className="home-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="page-shell relative grid gap-10 py-14 sm:py-16 lg:grid-cols-12 lg:items-center lg:gap-14 lg:py-20">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-home-mint">
                For providers
              </p>
              <h2 className="mt-3 max-w-2xl font-display text-[32px] font-extrabold leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl">
                Your skills deserve to be discovered.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                Join as an individual, team, business or agency. Show what you do, receive
                structured requests, and build a reputation that follows the work you complete.
              </p>

              <ul className="mt-7 space-y-3">
                {PROVIDER_BENEFITS.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-home-mint">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <p className="text-sm leading-relaxed text-white/70">
                      <span className="font-bold text-white">{title}.</span> {body}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/register" className="btn-on-dark btn-lg">
                  Join as a provider <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="#how-it-works" className="btn-on-dark-ghost btn-lg">
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-xs text-white/45">
                Create an account, then complete provider onboarding. Every application is reviewed.
              </p>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={100}>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                  Your provider profile
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { icon: Users, label: 'Business or individual profile' },
                    { icon: FileText, label: 'Services, pricing and portfolio' },
                    { icon: MapPin, label: 'Coverage area and availability' },
                    { icon: BadgeCheck, label: 'Identity verification badge' },
                    { icon: Star, label: 'Reviews from completed bookings' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-home-night/30 px-3.5 py-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-home-mint/15 text-home-mint">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-white/85">{label}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-white/45">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Applications are reviewed before a profile goes live.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          FAQ.
          ------------------------------------------------------------------ */}
      <section className="bg-home-mist">
        <div className="page-shell py-14 sm:py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <Reveal>
                <p className="eyebrow">FAQ</p>
                <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Straight answers.
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
                  The two questions everyone asks — money and verification — answered up front,
                  plus the rest.
                </p>
              </Reveal>
            </div>

            <div className="lg:col-span-8">
              <Reveal delay={80}>
                <div className="divide-y divide-ink-200 border-y border-ink-200">
                  {FAQS.map((f, i) => {
                    const open = openFaq === i;
                    const panelId = `landing-faq-${i}`;
                    return (
                      <div key={f.q}>
                        <h3>
                          <button
                            type="button"
                            onClick={() => setOpenFaq(open ? null : i)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            className="flex w-full items-center justify-between gap-6 py-5 text-left transition hover:text-brand-800"
                          >
                            <span className="text-sm font-bold text-ink-950 sm:text-[15px]">{f.q}</span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </h3>
                        {open && (
                          <p
                            id={panelId}
                            className="animate-fade-in max-w-2xl pb-5 pr-8 text-sm leading-relaxed text-ink-600"
                          >
                            {f.a}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Final CTA.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-14 sm:py-16 lg:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-brand-950 px-6 py-12 text-center text-white sm:px-10 sm:py-14 lg:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse 55% 70% at 12% 0%, rgb(255 255 255 / 0.16), transparent 60%), radial-gradient(ellipse 45% 60% at 95% 100%, rgb(134 239 172 / 0.22), transparent 62%)',
              }}
            />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-accent-400">
                <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
                Free for clients, always
              </p>
              <h2 className="mt-3 font-display text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl">
                Your neighbourhood&apos;s pros are one search away.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/70">
                Post what you need, compare quotes on one thread, and pay the provider — not the
                platform.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/search"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-bold text-brand-950 shadow-sm transition hover:bg-brand-50"
                >
                  Find a provider <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/requests/new"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/25 px-6 text-[15px] font-bold text-white transition hover:bg-white/10"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" /> Post a request
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
