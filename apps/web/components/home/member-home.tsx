'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  CalendarClock,
  MessagesSquare,
  LayoutDashboard,
  Briefcase,
  Bookmark,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, useSession } from '@/components/auth-provider';
import { PersonalizedSection } from '@/components/personalized-section';
import { RecommendedProviderCard } from '@/components/recommended-provider-card';
import { RecommendedServiceCard } from '@/components/recommended-service-card';
import { ProviderCard } from '@/components/provider-card';
import { StatusBadge } from '@/components/status-badge';
import { HomeSearch } from '@/components/home/home-search';
import { useI18n } from '@/components/locale-provider';
import {
  bookingsApi,
  favoritesApi,
  personalizationApi,
  requestsApi,
  savedSearchesApi,
} from '@/lib/api';

/**
 * The signed-in home at `/`.
 *
 * Deliberately a different page from the anonymous landing: no marketing
 * hero, no city ticker, no pitch. Instead the page is built around the
 * visitor's own data — a greeting, quick actions, their recent requests and
 * bookings, and the personalised rails from `GET /personalization/home`.
 */
export function MemberHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isClient, isProvider, isAdmin } = useSession();
  const [home, setHome] = useState<any>(null);
  const [interests, setInterests] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    personalizationApi
      .home()
      .then(setHome)
      .catch(() => setHome(null));

    Promise.allSettled([
      personalizationApi.interests(),
      isClient ? requestsApi.mine() : Promise.resolve([]),
      isClient ? bookingsApi.mineAsClient() : Promise.resolve([]),
      favoritesApi.list(),
      savedSearchesApi.list(),
    ]).then(([int, req, bok, fav, sav]) => {
      if (int.status === 'fulfilled') setInterests(int.value);
      if (req.status === 'fulfilled') setRequests(req.value);
      if (bok.status === 'fulfilled') setBookings(bok.value);
      if (fav.status === 'fulfilled') setFavoriteCount(fav.value.length);
      if (sav.status === 'fulfilled') setSavedSearches(sav.value);
    });
  }, [user, isClient]);

  const firstName = user?.firstName ?? 'there';
  const sections = home?.sections ?? {};

  const quickActions: { icon: LucideIcon; title: string; body: string; href: string }[] = isProvider
    ? [
        { icon: LayoutDashboard, title: t('home.actionDashboard'), body: t('home.actionDashboardBody'), href: '/dashboard' },
        { icon: Briefcase, title: t('home.actionManageServices'), body: t('home.actionManageServicesBody'), href: '/provider/offerings' },
        { icon: Search, title: t('home.actionFindProviders'), body: t('home.actionFindProvidersBody'), href: '/search' },
        { icon: MessagesSquare, title: t('home.actionMessages'), body: t('home.actionProviderMessagesBody'), href: '/messages' },
      ]
    : isAdmin
      ? [
          { icon: LayoutDashboard, title: t('home.actionAdminConsole'), body: t('home.actionAdminConsoleBody'), href: '/admin' },
          { icon: Search, title: t('home.actionFindProviders'), body: t('home.actionFindProvidersBody'), href: '/search' },
          { icon: MessagesSquare, title: t('home.actionMessages'), body: t('home.actionMessagesBody'), href: '/messages' },
          { icon: Bookmark, title: t('home.actionSavedSearches'), body: t('home.actionSavedSearchesBody'), href: '/saved-searches' },
        ]
      : [
          { icon: Plus, title: t('home.actionPostRequest'), body: t('home.actionPostRequestBody'), href: '/requests/new' },
          { icon: Search, title: t('home.actionFindProviders'), body: t('home.actionFindProvidersBody'), href: '/search' },
          { icon: CalendarClock, title: t('home.actionMyBookings'), body: t('home.actionMyBookingsBody'), href: '/bookings' },
          { icon: MessagesSquare, title: t('home.actionMessages'), body: t('home.actionMessagesBody'), href: '/messages' },
        ];

  const actionSummary: string[] = isClient
    ? [
        requests.length ? t('home.activeRequests', { count: requests.length }) : t('home.readyWhenYouAre'),
        t('home.noFeesEver'),
      ]
    : isProvider
      ? [t('home.workspaceSummary'), t('home.replyFast')]
      : [t('home.adminSummary'), t('home.adminModerate')];

  return (
    <main className="bg-canvas text-ink-900">
      {/* ------------------------------------------------------------------
          Member hero — light and personal, deliberately not the dark
          marketing hero. The search is the same component, just re-toned.
          ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-60" aria-hidden="true" />
        <div className="page-shell relative pb-12 pt-10 md:pb-16 md:pt-14">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="eyebrow">{t('home.eyebrow')}</p>
              <h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.03em] text-ink-950 sm:text-4xl lg:text-[44px]">
                {t('home.greeting', { name: firstName.split(' ')[0] })}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-600 md:text-base">
                {isClient
                  ? t('home.subtitleClient')
                  : isProvider
                    ? t('home.subtitleProvider')
                    : t('home.subtitleAdmin')}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {actionSummary.map((s) => (
                  <span key={s} className="chip bg-surface">{s}</span>
                ))}
              </div>

              <div className="mt-7 max-w-xl">
                <HomeSearch tone="light" />
              </div>
            </div>

            {/* Quick stats */}
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="surface-card p-5">
                  <p className="stat-label">{t('home.statSavedProviders')}</p>
                  <p className="stat-value">{favoriteCount ?? '—'}</p>
                  <p className="mt-1 text-xs text-ink-500">{t('home.statSavedProvidersSub')}</p>
                </div>
                <div className="surface-card p-5">
                  <p className="stat-label">{t('home.statSavedSearches')}</p>
                  <p className="stat-value">{savedSearches.length}</p>
                  <p className="mt-1 text-xs text-ink-500">{t('home.statSavedSearchesSub')}</p>
                </div>
                <div className="surface-card col-span-2 flex items-center justify-between gap-4 bg-home-forest p-5 text-white">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-home-mint">{t('home.statQuickAction')}</p>
                    <p className="mt-1 font-display text-lg font-extrabold">{isClient ? t('home.statClientCta') : isProvider ? t('home.statProviderCta') : t('home.statAdminCta')}</p>
                  </div>
                  <Link
                    href={isClient ? '/requests/new' : isProvider ? '/provider/offerings/new' : '/admin'}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-home-mint px-5 text-sm font-bold text-home-night transition hover:bg-[#a7f3c2]"
                  >
                    {t('home.go')} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <section className="page-shell pb-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ icon: Icon, title, body, href }) => (
            <Link key={title} href={href} className="surface-card-interactive group flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-home-mist text-brand-700 transition group-hover:bg-home-forest group-hover:text-home-mint">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-extrabold tracking-tight text-ink-950">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-500">{body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity — client's own requests and bookings */}
      {isClient && (requests.length > 0 || bookings.length > 0) && (
        <section className="page-shell py-8">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface-card">
              <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
                <h2 className="card-title">{t('home.recentRequests')}</h2>
                <Link href="/requests" className="btn-link text-sm">{t('home.allRequests')}</Link>
              </div>
              <ul className="divide-y divide-ink-100">
                {requests.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/requests/${r.id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-ink-50/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-950 group-hover:text-brand-700">{r.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-500">
                          {r.service?.name ?? t('home.serviceRequest')}
                          {r.quoteCount ? ` · ${t('home.quotes', { count: r.quoteCount })}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card">
              <div className="flex items-center justify-between border-b border-ink-900/10 px-5 py-4">
                <h2 className="card-title">{t('home.upcomingBookings')}</h2>
                <Link href="/bookings" className="btn-link text-sm">{t('home.allBookings')}</Link>
              </div>
              <ul className="divide-y divide-ink-100">
                {bookings.slice(0, 3).map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-ink-50/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink-950 group-hover:text-brand-700">
                          {b.serviceRequest?.title ?? b.serviceRequest?.service?.name}
                        </p>
                        <p className="mt-0.5 text-xs font-bold tabular text-ink-700">
                          {Number(b.agreedPrice).toLocaleString()}{' '}
                          <span className="font-semibold text-ink-400">{b.currency}</span>
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Personalized rails from the recommendation engine */}
      {sections.recommendedProviders && (
        <PersonalizedSection title={t('home.recForYou')} subtitle={t('home.recForYouSub')}>
          {sections.recommendedProviders.map((r: any) => (
            <RecommendedProviderCard key={r.entityId} recommendation={r} />
          ))}
        </PersonalizedSection>
      )}

      {sections.becauseYouViewed && (
        <PersonalizedSection title={t('home.becauseYouView', { category: sections.becauseYouViewed.categoryName })}>
          {sections.becauseYouViewed.services.map((s: any) => (
            <RecommendedServiceCard key={s.id} recommendation={{ data: s }} />
          ))}
        </PersonalizedSection>
      )}

      {sections.popularServices && (
        <PersonalizedSection title={t('home.popularServices')}>
          {sections.popularServices.map((s: any) => (
            <RecommendedServiceCard key={s.entityId} recommendation={s} />
          ))}
        </PersonalizedSection>
      )}

      {sections.nearbyProviders && (
        <PersonalizedSection title={t('home.nearbyProviders')}>
          {sections.nearbyProviders.map((r: any) => (
            <RecommendedProviderCard key={r.entityId} recommendation={r} />
          ))}
        </PersonalizedSection>
      )}

      {sections.highlyRatedProviders && (
        <PersonalizedSection title={t('home.highlyRated')}>
          {sections.highlyRatedProviders.map((r: any) => (
            <RecommendedProviderCard key={r.entityId} recommendation={r} />
          ))}
        </PersonalizedSection>
      )}

      {sections.recentlyViewed && (
        <PersonalizedSection title={t('home.continueExploring')} subtitle={t('home.recentlyViewed')}>
          {sections.recentlyViewed.map((p: any) => (
            <ProviderCard
              key={p.id}
              provider={{
                id: p.id,
                businessName: p.businessName,
                avatarUrl: p.logoUrl ?? p.user?.avatarUrl ?? null,
                rating: Number(p.rating),
                reviewCount: p.reviewCount,
                verificationStatus: p.verificationStatus,
                availabilityStatus: p.availabilityStatus,
                yearsOfExperience: p.yearsOfExperience,
                responseTimeMinutes: p.responseTimeMinutes,
                distanceKm: null,
                startingPrice: null,
                currency: 'RWF',
                latitude: p.location?.latitude ?? null,
                longitude: p.location?.longitude ?? null,
              }}
            />
          ))}
        </PersonalizedSection>
      )}

      {/* Interests + saved searches — two discovery rails in one band */}
      {(interests.length > 0 || savedSearches.length > 0) && (
        <section className="page-shell py-12 md:py-16">
          <div className="grid gap-6 lg:grid-cols-12">
            {interests.length > 0 && (
              <div className="lg:col-span-7">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  <h2 className="section-title">{t('home.interestsTitle')}</h2>
                </div>
                <p className="mt-1 mb-4 max-w-lg text-sm text-ink-500">
                  {t('home.interestsBody')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {interests.map((i) => {
                    const href = i.categoryId ? `/search?categoryId=${i.categoryId}` : `/search?serviceId=${i.serviceId}`;
                    const label = i.serviceName ?? i.categoryName;
                    if (!label) return null;
                    return (
                      <Link key={`${i.categoryId ?? 'c'}-${i.serviceId ?? 's'}`} href={href} className="chip-interactive">
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={interests.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
              <div className="surface-card h-full p-6">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  <h2 className="card-title">{t('home.statSavedSearches')}</h2>
                </div>
                {savedSearches.length > 0 ? (
                  <ul className="mt-4 divide-y divide-ink-100">
                    {savedSearches.slice(0, 4).map((s) => (
                      <li key={s.id}>
                        <Link href={`/search?serviceId=${s.serviceId ?? ''}${s.city ? `&location=${encodeURIComponent(s.city)}` : ''}`} className="flex items-center justify-between gap-3 py-2.5">
                          <span className="truncate text-sm font-bold text-ink-900">{s.name}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-ink-500">
                    {t('home.savedSearchesEmpty')}{' '}
                    <Link href="/saved-searches" className="text-link">{t('home.savedSearchesLink')}</Link>.
                  </p>
                )}
                <Link href="/saved-searches" className="btn-secondary mt-4 w-full sm:w-auto">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> {t('home.manageSavedSearches')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}