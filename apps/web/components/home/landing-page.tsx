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
  type LucideIcon,
} from 'lucide-react';
import { servicesApi } from '@/lib/api';
import { HomeSearch } from '@/components/home/home-search';
import { Reveal } from '@/components/home/reveal';

const CATEGORIES: { name: string; hint: string; icon: LucideIcon }[] = [
  { name: 'Plumbing', hint: 'Leaks, fittings, tanks', icon: Wrench },
  { name: 'Electrical', hint: 'Wiring, meters, solar', icon: Zap },
  { name: 'Cleaning', hint: 'Homes and offices', icon: Sparkles },
  { name: 'Painting', hint: 'Interiors and exteriors', icon: Paintbrush },
  { name: 'Auto repair', hint: 'Service and diagnostics', icon: Car },
  { name: 'Tech & software', hint: 'Build, fix, automate', icon: Laptop },
  { name: 'Photography', hint: 'Events and portraits', icon: Camera },
];

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Search locally',
    body: 'Tell us what you need and where. Nearby, identity-checked providers rise first — ranked by what actually matters to you.',
  },
  {
    icon: Quote,
    title: 'Compare on one thread',
    body: 'Every quote lands in the same structured thread, so scope, price and terms sit side by side instead of in a vague chat.',
  },
  {
    icon: ShieldCheck,
    title: 'Book, then review',
    body: 'Confirm the booking, get the work done, then leave a review that only a verified booking can post.',
  },
];

const TRUST = [
  {
    icon: BadgeCheck,
    title: 'Verified identities',
    body: 'Every provider clears an identity check before they appear as trusted.',
    span: 'sm:col-span-2',
  },
  {
    icon: Quote,
    title: 'Structured quotes',
    body: 'Scope, price and terms live in the thread — not buried in a chat.',
    span: '',
  },
  {
    icon: Wallet,
    title: 'You keep the money',
    body: 'No escrow, no middleman. Pay the provider directly when the work is done.',
    span: '',
  },
  {
    icon: MessageCircle,
    title: 'One place for the job',
    body: 'Quotes, messages, bookings and disputes stay attached to the same request.',
    span: 'sm:col-span-2',
  },
];

const AI_BULLETS = [
  { icon: Bot, title: 'A sentence becomes a request', body: 'Describe the job in plain language — the assistant drafts the title, description and the category-specific answers for you.' },
  { icon: Languages, title: 'English, Kinyarwanda or Français', body: 'Write or read the back-and-forth in any of the three languages. The generated request follows the language you used.' },
  { icon: CheckCircle2, title: 'You stay in control', body: 'Nothing is submitted for you. Every field stays editable and you press “Send request” yourself.' },
];

const CITIES = ['Kigali', 'Rubavu', 'Musanze', 'Huye', 'Rwamagana', 'Nyagatare', 'Rusizi', 'Muhanga'];

const PREVIEW_QUOTES = [
  { name: 'Kigali Flow Plumbing', meta: 'ID-checked · 12 min', price: '45,000', pick: true },
  { name: 'Nyamirambo Electric', meta: 'ID-checked · 28 min', price: '52,000', pick: false },
  { name: 'Kimisagara Fixes', meta: 'ID-checked · 41 min', price: '38,500', pick: false },
];

const FAQS = [
  {
    q: 'How is this different from listing in a directory?',
    a: 'A directory shows a name and a phone number. Here every provider clears an identity check before they can appear in search, quotes come back structured on one thread instead of drifting through private chats, and a booking is the only thing that unlocks a review — so the rating you see is tied to work that actually happened.',
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

export function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [popular, setPopular] = useState<string[]>([]);

  useEffect(() => {
    servicesApi
      .list()
      .then((list: any[]) => setPopular(list.slice(0, 8).map((s) => s.name)))
      .catch(() => setPopular(['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Auto repair', 'Photography', 'Wedding planning', 'Pest control']));
  }, []);

  return (
    <main className="bg-home-mist text-ink-900">
      {/* ------------------------------------------------------------------
          Hero — night ink + aurora, but tightened: gradient headline, a live
          request mock with floating status cards, and the search with quick
          chips so a visitor can act without typing.
          ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-home-night text-white">
        <div className="pointer-events-none absolute inset-0 bg-home-aurora" aria-hidden="true" />
        <div className="home-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(ellipse 70% 80% at 70% 40%, #000 20%, transparent 75%)',
          }}
        />

        <div className="page-shell relative grid items-center gap-14 pb-20 pt-10 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-16">
          <div className="lg:col-span-6 xl:col-span-6">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-2xs font-bold uppercase tracking-[0.16em] text-home-mint">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-home-mint opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-home-mint" />
              </span>
              Rwanda · local work, no middleman
            </p>

            <h1 className="font-display text-[34px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl sm:leading-[0.98] lg:text-[56px] xl:text-[64px]">
              Hire a verified local pro{' '}
              <span className="bg-gradient-to-r from-home-mint via-home-gold to-home-gold bg-clip-text text-transparent">
                in one search.
              </span>
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-white/60 md:text-lg">
              Plumbers, electricians, mechanics, developers and photographers — identity-checked,
              quoted in RWF, paid by you when the job is done.
            </p>

            <div className="mt-8">
              <HomeSearch tone="dark" suggestions={popular} />
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-white/10 pt-6 sm:gap-4">
              <div className="min-w-0">
                <dt className="text-2xs font-bold uppercase tracking-wider text-white/40">Providers</dt>
                <dd className="mt-1 inline-flex items-center gap-1 font-display text-sm font-extrabold text-white sm:gap-1.5 sm:text-lg">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-home-mint sm:h-4 sm:w-4" /> ID-checked
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-2xs font-bold uppercase tracking-wider text-white/40">Currency</dt>
                <dd className="mt-1 font-display text-sm font-extrabold text-white sm:text-lg">RWF</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-2xs font-bold uppercase tracking-wider text-white/40">Escrow</dt>
                <dd className="mt-1 font-display text-sm font-extrabold text-home-gold sm:text-lg">0%</dd>
              </div>
            </dl>
          </div>

          {/* Live request mock */}
          <div className="relative lg:col-span-6">
            <div className="absolute -left-6 top-8 hidden h-40 w-40 rounded-full bg-home-mint/20 blur-3xl lg:block" aria-hidden="true" />
            <div className="absolute -right-4 bottom-10 hidden h-48 w-48 rounded-full bg-home-gold/20 blur-3xl lg:block" aria-hidden="true" />

            <div className="relative mx-auto max-w-lg animate-float lg:ml-auto lg:max-w-none">
              <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/50">Example quote thread</p>
                  <span className="rounded-full bg-home-mint/15 px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-home-mint">
                    3 comparable
                  </span>
                </div>
                <div className="border-b border-white/10 bg-home-night/40 px-5 py-4">
                  <p className="text-[13px] font-semibold text-white">Kitchen leak · Kimihurura</p>
                  <p className="mt-1 text-xs text-white/45">Posted 18 min ago · open until tonight</p>
                </div>
                <ul className="divide-y divide-white/10 p-2">
                  {PREVIEW_QUOTES.map((q) => (
                    <li
                      key={q.name}
                      className={`flex items-center justify-between gap-3 rounded-2xl px-3 py-3 ${
                        q.pick ? 'bg-home-gold/15 ring-1 ring-home-gold/30' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{q.name}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {q.meta}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-sm font-extrabold tabular text-white">{q.price}</p>
                        <p className="text-2xs text-white/40">RWF</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-white/10 bg-home-night/40 px-5 py-4">
                  <p className="text-xs text-white/40">Pay the pro directly. We never hold funds.</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-home-gold">
                    Book selected <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </div>

              {/* Floating proof chips */}
              <div className="absolute -bottom-5 -left-3 hidden max-w-[220px] rounded-2xl border border-white/10 bg-home-forest p-4 text-white shadow-xl sm:block lg:-left-8">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-home-gold text-home-gold" aria-hidden="true" />
                  <p className="text-sm font-bold">Reviews from booked jobs</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                  Only verified bookings can rate a provider.
                </p>
              </div>

              <div className="absolute -right-2 -top-4 hidden animate-scale-in items-center gap-2 rounded-full border border-home-mint/30 bg-home-night/80 px-3 py-1.5 shadow-xl backdrop-blur sm:flex lg:-right-4">
                <CheckCircle2 className="h-3.5 w-3.5 text-home-mint" aria-hidden="true" />
                <span className="text-xs font-bold text-white">Identity verified</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10">
          <div className="flex overflow-hidden py-3">
            <div className="flex animate-marquee whitespace-nowrap">
              {[...CITIES, ...CITIES].map((city, i) => (
                <span key={`${city}-${i}`} className="mx-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Category architecture: bento.
          ------------------------------------------------------------------ */}
      <section className="home-hatch relative">
        <div className="page-shell py-12 md:py-16">
          <Reveal>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-brand-700">Catalogue</p>
                <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Start from the job, not a pitch.
                </h2>
              </div>
              <Link
                href="/search"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 underline-offset-4 hover:underline"
              >
                Browse all providers <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {CATEGORIES.map(({ name, hint, icon: Icon }, i) => (
                <Link
                  key={name}
                  href={`/search?q=${encodeURIComponent(name)}`}
                  className={`group relative overflow-hidden rounded-3xl border border-ink-900/10 bg-surface p-5 text-left shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-home-forest/30 hover:shadow-lg ${
                    i === 0 ? 'sm:col-span-2 sm:row-span-2 sm:p-7' : ''
                  }`}
                >
                  <span
                    className={`flex items-center justify-center rounded-2xl bg-home-mist text-brand-700 transition group-hover:bg-home-forest group-hover:text-home-mint ${
                      i === 0 ? 'h-14 w-14' : 'h-11 w-11'
                    }`}
                  >
                    <Icon className={i === 0 ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden="true" />
                  </span>
                  <span className={`mt-4 block font-display font-extrabold tracking-tight text-ink-950 ${i === 0 ? 'text-2xl' : 'text-base'}`}>
                    {name}
                  </span>
                  <span className="mt-1 block text-sm text-ink-500">{hint}</span>
                  {i === 0 && (
                    <span className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
                      Jump in <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          AI assistant feature — a product capability, surfaced as marketing.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-14 md:py-20">
        <div className="overflow-hidden rounded-[32px] border border-ink-900/10 bg-surface shadow-sm">
          <div className="grid gap-10 p-6 md:p-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <Reveal>
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-brand-700">AI-assist</p>
                <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Describe the job. We draft the request.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-600">
                  No need to learn a form. Say what&apos;s wrong in a sentence — the assistant turns
                  it into a structured request with the right category answers, then you review it
                  before it goes to providers.
                </p>
                <ul className="mt-8 space-y-4">
                  {AI_BULLETS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-home-forest text-home-mint">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="font-display text-base font-extrabold tracking-tight text-ink-950">{title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/requests/new" className="btn-primary btn-lg">
                    Try it with a request <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>
            </div>

            {/* Mock assistant conversation */}
            <div className="lg:col-span-6">
              <Reveal delay={100}>
                <div className="flex h-full min-h-[340px] flex-col justify-between rounded-3xl bg-home-night p-5 text-white sm:p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-home-forest ring-1 ring-home-mint/40">
                      <Bot className="h-4 w-4 text-home-mint" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">Booking assistant</p>
                      <p className="text-xs text-white/45">English · Kinyarwanda · Français</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-2.5 text-sm text-white/85">
                      I need a plumber to fix a leaking kitchen sink in Kimihurura, this Friday if possible.
                    </p>
                    <p className="max-w-[95%] rounded-2xl rounded-br-md bg-home-forest px-4 py-2.5 text-sm text-white/80">
                      Got it — leaking kitchen sink in Kimihurura. I&apos;ve drafted a request. What time works
                      for you, and is there a budget in mind?
                    </p>
                    <div className="max-w-[95%] rounded-2xl rounded-br-md border border-white/10 bg-white/[0.06] px-4 py-3">
                      <p className="text-xs font-bold text-home-mint">Drafted request</p>
                      <p className="mt-1.5 text-sm font-bold">Kitchen sink leak repair in Kimihurura</p>
                      <p className="mt-0.5 text-xs text-white/55">
                        Category: Plumbing · Preferred date: Friday · Open to quotes
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="rounded-full bg-home-gold/20 px-2.5 py-1 text-2xs font-bold text-home-gold">
                          You review before sending
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end gap-2 border-t border-white/10 pt-4">
                    <p className="flex-1 rounded-2xl bg-white/5 px-4 py-2.5 text-sm text-white/50">Friday morning, around 9. Budget ~45k…</p>
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-home-gold text-home-night">
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
          How it works: horizontal process.
          ------------------------------------------------------------------ */}
      <section id="how-it-works" className="scroll-mt-24 bg-home-sand">
        <div className="page-shell py-16 md:py-24">
          <Reveal>
            <div className="max-w-2xl">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-brand-700">How it works</p>
              <h2 className="mt-2.5 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-950 sm:text-5xl">
                Three moves. No escrow games.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <ol className="relative mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              <span
                className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-px bg-home-night/15 md:block"
                aria-hidden="true"
              />
              {HOW_IT_WORKS.map((step, i) => (
                <li key={step.title} className="relative">
                  <span className="relative z-10 mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-home-night font-display text-xl font-extrabold text-home-gold">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-display text-xl font-extrabold tracking-tight text-ink-950">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------------
          Trust bento over a forest field.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-16 md:py-20">
        <Reveal>
          <div className="overflow-hidden rounded-[32px] bg-home-forest px-6 py-10 text-white md:px-12 md:py-14">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-5">
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-home-mint">Trust layer</p>
                <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">
                  Built on verification, not promises.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
                  Verified providers, real reviews and structured quotes so you always know what you
                  are agreeing to. Payment for the actual service happens between you and the provider.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-home-gold px-6 text-[15px] font-bold text-home-night hover:bg-[#edc27e]">
                    Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link href="/search" className="inline-flex h-12 items-center rounded-2xl border border-white/15 px-6 text-[15px] font-bold text-white hover:bg-white/5">
                    Browse providers
                  </Link>
                </div>
                <p className="mt-5 flex items-center gap-1.5 text-xs text-white/45">
                  <Star className="h-3.5 w-3.5 fill-home-gold text-home-gold" aria-hidden="true" />
                  Free to search. Free to post a request.
                </p>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-7">
                {TRUST.map(({ icon: Icon, title, body, span }) => (
                  <li
                    key={title}
                    className={`rounded-3xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-sm transition hover:bg-white/[0.08] ${span}`}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-home-mint/15 text-home-mint">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-base font-bold">{title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/55">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------------------------
          FAQ — collapsed list keeps the page tight.
          ------------------------------------------------------------------ */}
      <section className="bg-home-sand">
        <div className="page-shell py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Reveal>
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-brand-700">FAQ</p>
                <h2 className="mt-2.5 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-950 sm:text-4xl">
                  Straight answers.
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
                  The two questions everyone asks — money and verification — answered up front, plus
                  the rest.
                </p>
              </Reveal>
            </div>
            <div className="lg:col-span-8">
              <Reveal delay={80}>
                <div className="space-y-2">
                  {FAQS.map((f, i) => {
                    const open = openFaq === i;
                    return (
                      <div key={f.q} className="overflow-hidden rounded-2xl border border-ink-900/10 bg-surface shadow-xs">
                        <button
                          type="button"
                          onClick={() => setOpenFaq(open ? null : i)}
                          aria-expanded={open}
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <span className="text-sm font-bold text-ink-950">{f.q}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                          />
                        </button>
                        {open && (
                          <p className="animate-fade-in border-t border-ink-100 px-5 py-4 text-sm leading-relaxed text-ink-600">
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
          Final CTA band.
          ------------------------------------------------------------------ */}
      <section className="page-shell py-16 md:py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-home-night px-6 py-14 text-center text-white md:px-12">
            <div className="pointer-events-none absolute inset-0 bg-home-aurora" aria-hidden="true" />
            <div className="home-grain pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative mx-auto max-w-2xl">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-home-mint">
                <MapPin className="mr-1 inline h-3.5 w-3.5 text-home-mint" aria-hidden="true" />
                Free for clients, always
              </p>
              <h2 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl">
                Your neighbourhood&apos;s pros are one search away.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-white/60">
                Post what you need, compare quotes on one thread, and pay the provider — not the platform.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-2xl bg-home-gold px-7 text-[15px] font-bold text-home-night hover:bg-[#edc27e]">
                  Get started <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/requests/new"
                  className="inline-flex h-12 items-center rounded-2xl border border-white/15 px-7 text-[15px] font-bold text-white hover:bg-white/5"
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