import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  Heart,
  Images,
  MapPin,
  MessageSquareQuote,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { ApiError, providersApi, reviewsApi } from '@/lib/api';
import {
  SITE_NAME,
  SITE_URL,
  absoluteImageUrl,
  absoluteUrl,
  providerDescription,
  providerTitle,
} from '@/lib/seo';
import { FavoriteButton } from '@/components/favorite-button';
import { VerificationBadge, VerificationLabel } from '@/components/verification-badge';
import { ReportButton } from '@/components/report-button';
import { PortfolioGallery } from '@/components/portfolio-gallery';
import { ProviderLocationMap } from '@/components/provider-location-map';
import { ServesYourAreaCheck } from '@/components/serves-your-area-check';
import { MessageProviderButton } from '@/components/message-provider-button';

export const dynamic = 'force-dynamic';

const BREAKDOWN_LABELS: [string, string][] = [
  ['quality', 'Quality'],
  ['communication', 'Communication'],
  ['professionalism', 'Professionalism'],
  ['value', 'Value'],
];

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Independent professional',
  TEAM: 'Team',
  BUSINESS: 'Business',
  AGENCY: 'Agency',
};

function providerTypeLabel(type?: string | null) {
  if (!type) return 'Local provider';
  return PROVIDER_TYPE_LABELS[type] ?? 'Local provider';
}

function availabilityText(availability: any): { text: string; available: boolean } | null {
  if (!availability) return null;
  if (availability.paused || !availability.nextAvailableDate) {
    return { text: 'Currently unavailable', available: false };
  }
  if (availability.availableToday) return { text: 'Available today', available: true };
  if (availability.availableTomorrow) return { text: 'Available tomorrow', available: true };
  return { text: `Next available ${availability.nextAvailableLabel}`, available: true };
}

function formatDate(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMonth(value?: string | Date | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function experienceRange(item: any) {
  const start = formatMonth(item.startDate) ?? '—';
  const end = item.isCurrent ? 'Present' : formatMonth(item.endDate) ?? 'Present';
  return `${start} — ${end}`;
}

function educationRange(item: any) {
  const start = formatMonth(item.startDate);
  const end = formatMonth(item.endDate);
  if (start && end) return `${start} — ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

/* Section header used across the profile — an icon chip, an eyebrow and a
   title, so every block on the page reads from the same rhythm. */
function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  meta,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="card-title mt-0.5">{title}</h2>
        </div>
      </div>
      {meta}
    </div>
  );
}

function RatingBars({ breakdown }: { breakdown: Record<string, number> }) {
  const rows = BREAKDOWN_LABELS.map(([key, label]) => [label, breakdown?.[key]] as const).filter(
    ([, value]) => value != null,
  );
  if (rows.length === 0) return null;

  return (
    <dl className="space-y-3">
      {rows.map(([label, value]) => {
        const pct = Math.max(0, Math.min(100, ((value as number) / 5) * 100));
        return (
          <div key={label} className="flex items-center gap-3">
            <dt className="w-28 shrink-0 text-xs font-medium text-ink-500">{label}</dt>
            <dd className="flex flex-1 items-center gap-2.5">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-rating-400 to-rating-500"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-7 shrink-0 text-right text-xs font-bold tabular text-ink-800">
                {(value as number).toFixed(1)}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function HeroMetric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-home-mint ring-1 ring-inset ring-white/10">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-extrabold leading-none tabular tracking-tight text-white">
          {value}
        </p>
        <p className="mt-1 truncate text-2xs font-bold uppercase tracking-wider text-white/45">{label}</p>
      </div>
    </div>
  );
}

function AtAGlanceRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-100">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-bold uppercase tracking-wider text-ink-400">{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-ink-800">{children}</div>
      </div>
    </li>
  );
}

const PROVIDER_FETCH_ATTEMPTS = 3;
const PROVIDER_FETCH_RETRY_DELAY_MS = 300;

// A provider that genuinely doesn't exist should 404, but a temporarily
// unreachable API (Neon cold start, transient 5xx) must not be presented as
// "not found" — retry briefly, then let the error bubble up to Next's error
// boundary instead of calling notFound().
async function loadProvider(id: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < PROVIDER_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await providersApi.getPublic(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) notFound();
      lastError = error;
      if (error instanceof ApiError && error.status < 500) throw error;
      if (attempt < PROVIDER_FETCH_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, PROVIDER_FETCH_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

const getProvider = cache(loadProvider);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const provider: any = await getProvider(params.id);
  const title = providerTitle(provider);
  const description = providerDescription(provider);
  const canonical = `/providers/${provider.id}`;
  const image = absoluteImageUrl(provider.logoUrl ?? provider.user?.avatarUrl);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'profile',
      title,
      description,
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      ...(image ? { images: [{ url: image, alt: `${provider.businessName} on ${SITE_NAME}` }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProviderProfilePage({ params }: { params: { id: string } }) {
  const provider: any = await getProvider(params.id);
  const reviewSummary: any = await reviewsApi.summary(params.id).catch(() => null);

  const services: any[] = provider.services ?? [];
  const pricedServices = services.filter((s: any) => s.basePrice != null);
  const startingPrice = pricedServices.length
    ? Math.min(...pricedServices.map((s: any) => Number(s.basePrice)))
    : null;
  const currency = services.find((s: any) => s.currency)?.currency ?? 'RWF';

  const fullName = `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim();
  const initial = provider.businessName?.charAt(0)?.toUpperCase() ?? 'P';
  const avatarUrl = provider.logoUrl ?? provider.user?.avatarUrl;
  const hasSummary = reviewSummary?.count > 0;
  const rating = hasSummary ? Number(reviewSummary.overall) : 0;
  const reviewCount = reviewSummary?.count ?? 0;
  const availability = availabilityText(provider.availability);
  const today = new Date().getDay();

  const trustSignals = [
    provider.verificationStatus === 'VERIFIED' && {
      icon: BadgeCheck,
      label: 'Identity verified',
      body: 'Passed a live identity check.',
    },
    provider.businessVerified && {
      icon: ShieldCheck,
      label: 'Business verified',
      body: 'Business documents reviewed.',
    },
    reviewSummary?.verifiedCount > 0 && {
      icon: MessageSquareQuote,
      label: `${reviewSummary.verifiedCount} verified review${reviewSummary.verifiedCount === 1 ? '' : 's'}`,
      body: 'Written after a completed booking.',
    },
    provider.responseRateSummary && {
      icon: Zap,
      label: `${provider.responseRateSummary.percentage}% quote response rate`,
      body: `Quoted on ${provider.responseRateSummary.answeredRequests} of ${provider.responseRateSummary.totalRequests} non-cancelled service requests.`,
    },
  ].filter(Boolean) as { icon: LucideIcon; label: string; body: string }[];

  const providerUrl = absoluteUrl(`/providers/${provider.id}`);
  const topCategory = services[0]?.service?.category?.name;
  const schemaType =
    provider.providerType === 'BUSINESS' || provider.providerType === 'AGENCY'
      ? 'LocalBusiness'
      : 'ProfessionalService';

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': schemaType,
        '@id': `${providerUrl}#business`,
        name: provider.businessName,
        description: provider.description || provider.bio || providerDescription(provider),
        url: providerUrl,
        ...(avatarUrl ? { image: absoluteImageUrl(avatarUrl) } : {}),
        ...(provider.phone ? { telephone: provider.phone } : {}),
        ...(provider.location
          ? {
              address: {
                '@type': 'PostalAddress',
                ...(provider.location.city ? { addressLocality: provider.location.city } : {}),
                addressCountry: provider.location.country || 'RW',
              },
            }
          : {}),
        ...(provider.location?.latitude != null && provider.location?.longitude != null
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: provider.location.latitude,
                longitude: provider.location.longitude,
              },
            }
          : {}),
        ...(provider.serviceAreas?.length
          ? { areaServed: provider.serviceAreas.map((area: any) => area.label) }
          : {}),
        ...(hasSummary
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: rating,
                reviewCount,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}),
        ...(services.length
          ? {
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: `Services by ${provider.businessName}`,
                itemListElement: services.slice(0, 12).map((offering: any) => ({
                  '@type': 'Offer',
                  itemOffered: {
                    '@type': 'Service',
                    name: offering.title || offering.service?.name,
                    ...(offering.description ? { description: offering.description } : {}),
                  },
                  ...(offering.basePrice != null
                    ? { price: Number(offering.basePrice), priceCurrency: offering.currency || 'RWF' }
                    : {}),
                })),
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          ...(topCategory
            ? [
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: topCategory,
                  item: `${SITE_URL}/search?q=${encodeURIComponent(topCategory)}`,
                },
              ]
            : []),
          {
            '@type': 'ListItem',
            position: topCategory ? 3 : 2,
            name: provider.businessName,
            item: providerUrl,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <main className="page-workspace pb-28 pt-6 md:pb-12 md:pt-8">
      {/* ------------------------------------------------------------------
          Hero. A night surface with the aurora mesh, so the profile opens on
          the same light as the landing page. Identity, trust and the primary
          actions sit here; the proof numbers run across the base.
          ------------------------------------------------------------------ */}
      <header className="relative overflow-hidden rounded-3xl bg-home-night text-white shadow-xl animate-fade-up">
        <div className="pointer-events-none absolute inset-0 bg-home-aurora" aria-hidden="true" />
        <div className="home-grain pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 90% at 75% 20%, #000 15%, transparent 72%)',
          }}
        />

        <div className="relative flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <div className="absolute -inset-3 rounded-[28px] bg-home-mint/20 blur-2xl" aria-hidden="true" />
              <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-900 shadow-2xl ring-1 ring-inset ring-white/15 sm:h-24 sm:w-24">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-extrabold text-white">{initial}</span>
                )}
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-2xs font-bold uppercase tracking-[0.16em] text-home-mint">
                {providerTypeLabel(provider.providerType)}
              </p>
              <h1 className="mt-1.5 font-display text-2xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[32px]">
                {provider.businessName}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <VerificationLabel
                  status={provider.verificationStatus}
                  businessVerified={provider.businessVerified}
                />
                {reviewCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-2xs font-bold uppercase tracking-wide text-white backdrop-blur">
                    <Star className="h-3 w-3 fill-rating-400 text-rating-400" aria-hidden="true" />
                    {rating.toFixed(1)}
                    <span className="font-semibold normal-case tracking-normal text-white/50">
                      ({reviewCount})
                    </span>
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/60">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
                  {provider.location?.city ?? 'Location not set'}
                </span>
                {availability && (
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      availability.available ? 'text-home-mint' : 'text-white/45'
                    }`}
                  >
                    <span className="relative flex h-1.5 w-1.5">
                      {availability.available && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-home-mint opacity-60" />
                      )}
                      <span
                        className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                          availability.available ? 'bg-home-mint' : 'bg-white/40'
                        }`}
                      />
                    </span>
                    {availability.text}
                  </span>
                )}
                {fullName && <span className="text-white/45">Contact: {fullName}</span>}
              </div>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden w-56 shrink-0 flex-col gap-2 md:flex">
            <Link href={`/requests/new?providerId=${provider.id}`} className="btn-on-dark w-full">
              Request a booking
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <MessageProviderButton
              providerId={provider.id}
              providerName={provider.businessName}
              className="btn-on-dark-ghost w-full"
              label="Send a message"
            />
            <FavoriteButton
              providerId={provider.id}
              className="btn w-full border border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
            />
            <p className="text-center text-2xs leading-relaxed text-white/50">
              Free request → quote → accept to book. You pay the provider directly.
            </p>
          </div>
        </div>

        {/* Proof strip */}
        <dl className="relative grid grid-cols-2 divide-white/10 border-t border-white/10 sm:grid-cols-4 sm:divide-x">
          <HeroMetric
            icon={Star}
            value={hasSummary ? rating.toFixed(1) : '—'}
            label={
              reviewSummary
                ? reviewCount > 0
                  ? `${reviewCount} reviews`
                  : 'No reviews'
                : 'Rating unavailable'
            }
          />
          <HeroMetric
            icon={Award}
            value={provider.yearsOfExperience > 0 ? `${provider.yearsOfExperience} yrs` : 'New'}
            label="Experience"
          />
          <HeroMetric icon={BadgeCheck} value={provider.completedJobCount} label="Completed jobs" />
          <HeroMetric icon={Wrench} value={services.length || '—'} label="Services listed" />
        </dl>
      </header>

      <div className="mt-3 flex justify-end">
        <ReportButton
          targetType="PROVIDER"
          targetId={provider.id}
          label="Report suspicious behavior"
          className="btn btn-sm w-fit justify-start text-ink-500 hover:bg-danger-50 hover:text-danger-700"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {(provider.description || provider.bio) && (
            <section className="surface-card p-5 sm:p-6">
              <SectionHeading icon={Sparkles} eyebrow="Overview" title={`About ${provider.businessName}`} />
              <div className="space-y-4">
                {provider.description && (
                  <p className="prose-copy whitespace-pre-line leading-relaxed">{provider.description}</p>
                )}
                {provider.bio && (
                  <div className={provider.description ? 'border-t border-ink-100 pt-4' : ''}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-ink-400">
                      About the provider
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-ink-600">
                      {provider.bio}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="surface-card p-5 sm:p-6">
            <SectionHeading
              icon={Wrench}
              eyebrow="Catalogue"
              title="Services"
              meta={
                services.length > 0 ? (
                  <span className="chip py-1 text-2xs">{services.length} listed</span>
                ) : null
              }
            />

            {services.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {services.map((offering: any) => (
                  <Link
                    key={offering.id}
                    href={`/service-offerings/${offering.id}`}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
                  >
                    <span
                      className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-brand-50 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <div className="relative flex items-start justify-between gap-2">
                      <p className="text-sm font-bold tracking-tight text-ink-950 group-hover:text-brand-800">
                        {offering.title || offering.service?.name}
                      </p>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" aria-hidden="true" />
                    </div>
                    {offering.service?.category?.name && (
                      <p className="relative mt-1 text-xs font-medium text-ink-500">
                        {offering.service.category.name}
                      </p>
                    )}

                    {offering.basePrice != null && (
                      <p className="relative mt-3 text-lg font-extrabold tabular tracking-tight text-ink-950">
                        {offering.priceType === 'STARTING_FROM' && (
                          <span className="mr-1 align-middle text-2xs font-bold uppercase tracking-wide text-ink-400">
                            From
                          </span>
                        )}
                        {Number(offering.basePrice).toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-ink-500">{offering.currency}</span>
                      </p>
                    )}

                    {offering.attributeValues?.length > 0 && (
                      <div className="relative mt-3 flex flex-wrap gap-1">
                        {offering.attributeValues.slice(0, 3).map((v: any) => {
                          const label =
                            v.booleanValue === true
                              ? v.categoryAttribute.name
                              : v.jsonValue?.length
                                ? v.jsonValue[0]
                                : v.textValue;
                          if (!label) return null;
                          return (
                            <span key={v.id} className="chip py-0.5 text-2xs font-medium">
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state py-10">
                <Wrench className="h-5 w-5 text-ink-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-ink-800">No services listed yet</p>
                <p className="mt-1 text-sm text-ink-500">This provider hasn&apos;t published any services.</p>
              </div>
            )}
          </section>

          <section className="surface-card p-5 sm:p-6">
            <SectionHeading icon={Images} eyebrow="Proof of work" title="Portfolio" />
            <PortfolioGallery projects={provider.portfolios ?? []} />
          </section>

          {provider.experiences?.length > 0 && (
            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={BriefcaseBusiness}
                eyebrow="Career"
                title="Experience"
                meta={<span className="chip py-1 text-2xs">{provider.experiences.length} roles</span>}
              />
              <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-[0.9375rem] before:top-3 before:w-px before:bg-ink-100">
                {provider.experiences.map((item: any) => (
                  <li key={item.id} className="relative flex gap-3.5">
                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                      <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-ink-950">{item.title}</p>
                        {item.isCurrent && <span className="badge badge-success">Current</span>}
                      </div>
                      <p className="text-sm font-medium text-ink-700">{item.organization}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {experienceRange(item)}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                      {item.description && (
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {provider.educations?.length > 0 && (
            <section className="surface-card p-5 sm:p-6">
              <SectionHeading
                icon={GraduationCap}
                eyebrow="Learning"
                title="Education"
                meta={<span className="chip py-1 text-2xs">{provider.educations.length} entries</span>}
              />
              <ul className="grid gap-3 sm:grid-cols-2">
                {provider.educations.map((item: any) => {
                  const range = educationRange(item);
                  return (
                    <li key={item.id} className="rounded-2xl border border-ink-200 bg-surface p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
                          <GraduationCap className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-950">{item.school}</p>
                          {(item.degree || item.fieldOfStudy) && (
                            <p className="mt-0.5 text-xs font-medium text-ink-700">
                              {[item.degree, item.fieldOfStudy].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {range && <p className="mt-0.5 text-xs text-ink-500">{range}</p>}
                        </div>
                      </div>
                      {item.skills?.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {item.skills.map((skill: string) => (
                            <span key={skill} className="chip py-0.5 text-2xs font-semibold">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.description && (
                        <p className="mt-2.5 whitespace-pre-line text-sm leading-relaxed text-ink-600">{item.description}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="surface-card p-5 sm:p-6">
            <SectionHeading
              icon={MessageSquareQuote}
              eyebrow="Reputation"
              title="Reviews"
              meta={
                hasSummary ? (
                  <span className="badge badge-brand">
                    {reviewSummary.count} total
                  </span>
                ) : null
              }
            />

            {hasSummary && (
              <div className="mb-6 overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-ink-50 to-white p-5">
                <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                  <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:gap-2 sm:pr-6 sm:[border-right:1px_solid] sm:border-ink-100">
                    <span className="font-display text-4xl font-extrabold tabular leading-none tracking-tight text-ink-950">
                      {Number(reviewSummary.overall).toFixed(1)}
                    </span>
                    <div>
                      <span className="flex items-center gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`h-4 w-4 ${
                              n <= Math.round(Number(reviewSummary.overall))
                                ? 'fill-rating-400 text-rating-400'
                                : 'text-ink-200'
                            }`}
                          />
                        ))}
                      </span>
                      <p className="mt-1 text-xs text-ink-500">out of 5</p>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <RatingBars breakdown={reviewSummary.breakdown} />
                  </div>
                </div>

                {reviewSummary.verifiedCount > 0 && (
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
                    <span className="badge badge-success">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                      {reviewSummary.verifiedCount} verified bookings
                    </span>
                    <span className="text-xs text-ink-500">
                      Only clients with a completed booking can review.
                    </span>
                  </div>
                )}
              </div>
            )}

            {provider.reviews?.length ? (
              <ul className="space-y-3">
                {provider.reviews.map((r: any) => {
                  const name = `${r.client?.user?.firstName ?? ''} ${r.client?.user?.lastName ?? ''}`.trim();
                  const reviewerInitial = name.charAt(0).toUpperCase() || 'C';
                  return (
                    <li key={r.id} className="rounded-2xl border border-ink-200 bg-surface p-4 transition hover:border-ink-300">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-display text-sm font-extrabold text-white dark:text-home-night">
                          {reviewerInitial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="text-sm font-bold text-ink-900">{name || 'Client'}</span>
                            {formatDate(r.createdAt) && (
                              <span className="text-2xs font-medium text-ink-400">
                                {formatDate(r.createdAt)}
                              </span>
                            )}
                            {r.verifiedBooking && (
                              <span className="badge badge-success">
                                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                                Verified booking
                              </span>
                            )}
                          </div>

                          <span className="mt-1.5 flex items-center gap-0.5" aria-label={`${r.rating} out of 5`}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`h-3.5 w-3.5 ${
                                  n <= r.rating ? 'fill-rating-400 text-rating-400' : 'text-ink-200'
                                }`}
                                aria-hidden="true"
                              />
                            ))}
                            <span className="ml-1 text-xs font-bold tabular text-ink-700">{r.rating}.0</span>
                          </span>

                          {r.comment && (
                            <p className="mt-2 text-sm leading-relaxed text-ink-600">{r.comment}</p>
                          )}

                          {r.images?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {r.images.map((img: any) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={img.id}
                                  src={img.url}
                                  alt=""
                                  className="h-16 w-16 rounded-xl object-cover ring-1 ring-inset ring-ink-200"
                                />
                              ))}
                            </div>
                          )}

                          {r.providerResponse && (
                            <div className="mt-3 rounded-xl border-l-2 border-brand-300 bg-brand-50/60 p-3.5 text-sm">
                              <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-brand-700">
                                Response from {provider.businessName}
                              </p>
                              <p className="leading-relaxed text-ink-700">{r.providerResponse.text}</p>
                            </div>
                          )}

                          <div className="mt-2.5">
                            <ReportButton targetType="REVIEW" targetId={r.id} label="Report review" />
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="empty-state py-10">
                <Star className="h-5 w-5 text-ink-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-ink-800">No reviews yet</p>
                <p className="mt-1 text-sm text-ink-500">
                  Only clients with a completed booking can leave a review.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* Right column — the "trust column". Sticky so the CTA is always
            reachable while reading reviews. */}
        <aside className="space-y-4">
          <div className="surface-card overflow-hidden lg:sticky lg:top-24">
            {startingPrice != null ? (
              <div className="relative overflow-hidden bg-home-night px-5 py-4 text-white">
                <div className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-90" aria-hidden="true" />
                <div className="relative">
                  <p className="text-2xs font-bold uppercase tracking-[0.16em] text-white/50">
                    Services from
                  </p>
                  <p className="mt-1 font-display text-2xl font-extrabold tabular tracking-tight">
                    {startingPrice.toLocaleString()}{' '}
                    <span className="text-sm font-semibold text-white/60">{currency}</span>
                  </p>
                  <p className="mt-1 text-2xs text-white/50">Final price agreed in the quote thread.</p>
                </div>
              </div>
            ) : (
              <div className="border-b border-ink-100 px-5 py-4">
                <p className="text-2xs font-bold uppercase tracking-[0.16em] text-ink-400">Pricing</p>
                <p className="mt-1 text-sm font-semibold text-ink-700">Contact for a quote</p>
              </div>
            )}

            <div className="space-y-4 p-5">
              <div>
                <h3 className="card-title">At a glance</h3>
                <ul className="mt-3.5 space-y-3">
                  <AtAGlanceRow icon={MapPin} label="Based in">
                    {[provider.location?.city, provider.location?.country].filter(Boolean).join(', ') ||
                      'Location not set'}
                  </AtAGlanceRow>
                  {provider.phone && (
                    <AtAGlanceRow icon={Phone} label="Contact">
                      <a
                        href={`tel:${provider.phone}`}
                        className="break-all text-brand-700 underline decoration-brand-200 underline-offset-2 hover:text-brand-900"
                      >
                        {provider.phone}
                      </a>
                    </AtAGlanceRow>
                  )}
                  <AtAGlanceRow icon={CalendarClock} label="Availability">
                    {availability ? availability.text : 'Not set'}
                  </AtAGlanceRow>
                  <AtAGlanceRow icon={TrendingUp} label="Experience">
                    {provider.yearsOfExperience > 0
                      ? `${provider.yearsOfExperience} years`
                      : 'New to the platform'}
                  </AtAGlanceRow>
                  {provider.serviceRadiusKm > 0 && (
                    <AtAGlanceRow icon={MapPin} label="Service radius">
                      {provider.serviceRadiusKm} km
                    </AtAGlanceRow>
                  )}
                  {provider.providerType === 'TEAM' && provider.teamSize > 0 && (
                    <AtAGlanceRow icon={Users} label="Team size">
                      {provider.teamSize} members
                    </AtAGlanceRow>
                  )}
                </ul>
              </div>

              {trustSignals.length > 0 && (
                <>
                  <div className="section-divider" />
                  <div>
                    <h3 className="card-title">Why you can trust this profile</h3>
                    <ul className="mt-3 space-y-2.5">
                      {trustSignals.map((signal) => (
                        <li key={signal.label} className="flex items-start gap-2.5">
                          <signal.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                          <div>
                            <p className="text-sm font-semibold text-ink-800">{signal.label}</p>
                            <p className="text-xs text-ink-500">{signal.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}

              <div className="section-divider" />
              <ServesYourAreaCheck providerId={provider.id} />

              <div className="space-y-2 pt-1">
                <Link href={`/requests/new?providerId=${provider.id}`} className="btn-primary w-full">
                  Request a booking
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <MessageProviderButton
                  providerId={provider.id}
                  providerName={provider.businessName}
                  className="btn-secondary w-full"
                  label="Send a message"
                />
                <FavoriteButton providerId={provider.id} className="btn-secondary w-full" />
                <p className="pt-1 text-center text-2xs leading-relaxed text-ink-400">
                  Free request → quote → accept to book. You pay the provider directly.
                </p>
              </div>
            </div>
          </div>

          {provider.location?.latitude != null && provider.location?.longitude != null && (
            <div className="surface-card p-5">
              <h3 className="card-title mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Location &amp; coverage
              </h3>
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <ProviderLocationMap
                  latitude={provider.location.latitude}
                  longitude={provider.location.longitude}
                  serviceAreas={provider.serviceAreas}
                />
              </div>
              {provider.serviceAreas?.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-xs text-ink-500">
                  {provider.serviceAreas.map((a: any) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
                      {a.label ?? 'Coverage area'} — {a.radiusKm} km radius
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {provider.availability?.weekly && (
            <div className="surface-card p-5">
              <h3 className="card-title mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden="true" />
                Weekly hours
              </h3>
              <dl className="space-y-1.5 text-xs">
                {provider.availability.weekly.map((d: any) => {
                  const isToday = d.dayOfWeek === today;
                  return (
                    <div
                      key={d.dayOfWeek}
                      className={`flex justify-between gap-3 rounded-lg px-2 py-1.5 ${
                        isToday ? 'bg-brand-50 font-semibold' : ''
                      }`}
                    >
                      <dt className={isToday ? 'text-brand-800' : 'font-medium text-ink-600'}>
                        {d.day}
                        {isToday && <span className="ml-1.5 text-2xs font-bold uppercase text-brand-600">Today</span>}
                      </dt>
                      <dd className={d.hours === 'Unavailable' ? 'text-ink-300' : 'font-semibold text-ink-800'}>
                        {d.hours}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

        </aside>
      </div>

      {/* Mobile sticky action bar — above the mobile tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t border-ink-200 bg-surface/90 p-3 backdrop-blur-xl md:hidden">
        <MessageProviderButton
          providerId={provider.id}
          providerName={provider.businessName}
          className="btn-secondary flex-1"
          label="Message"
        />
        <Link href={`/requests/new?providerId=${provider.id}`} className="btn-primary flex-[1.4]">
          Request a booking
        </Link>
      </div>
    </main>
    </>
  );
}
