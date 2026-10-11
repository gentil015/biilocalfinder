import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Clock, MapPin, Star, CalendarClock, BadgeCheck, TrendingUp } from 'lucide-react';
import { providersApi, reviewsApi } from '@/lib/api';
import { FavoriteButton } from '@/components/favorite-button';
import { VerificationBadge, VerificationLabel } from '@/components/verification-badge';
import { AvailabilityBadge } from '@/components/availability-badge';
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

function RatingBars({ breakdown }: { breakdown: Record<string, number> }) {
  const rows = BREAKDOWN_LABELS.map(([key, label]) => [label, breakdown?.[key]] as const).filter(
    ([, value]) => value != null,
  );
  if (rows.length === 0) return null;

  return (
    <dl className="mt-4 space-y-2.5">
      {rows.map(([label, value]) => {
        const pct = Math.max(0, Math.min(100, ((value as number) / 5) * 100));
        return (
          <div key={label} className="flex items-center gap-3">
            <dt className="w-28 shrink-0 text-xs font-medium text-ink-500">{label}</dt>
            <dd className="flex flex-1 items-center gap-2.5">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                <span
                  className="block h-full rounded-full bg-rating-400"
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

export default async function ProviderProfilePage({ params }: { params: { id: string } }) {
  let provider: any;
  let reviewSummary: any = null;
  try {
    provider = await providersApi.getPublic(params.id);
    reviewSummary = await reviewsApi.summary(params.id).catch(() => null);
  } catch {
    notFound();
  }

  const fullName = `${provider.user?.firstName ?? ''} ${provider.user?.lastName ?? ''}`.trim();
  const initial = provider.businessName?.charAt(0)?.toUpperCase() ?? 'P';
  const hasSummary = reviewSummary?.count > 0;

  return (
    <main className="page-workspace pb-28 pt-6 md:pb-12 md:pt-8">
      {/* ------------------------------------------------------------------
          Identity header. Name, trust and rating in one block — the three
          things a buyer checks before anything else.
          ------------------------------------------------------------------ */}
      <div className="surface-card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-ink-950 via-ink-900 to-brand-900" aria-hidden="true" />

        <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="flex min-w-0 items-start gap-4">
            <div className="-mt-12 h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-lg ring-4 ring-white md:-mt-14 md:h-24 md:w-24">
              {provider.user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={provider.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-3xl font-extrabold text-white">
                  {initial}
                </div>
              )}
            </div>

            <div className="min-w-0 pt-1 md:pt-2">
              <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-extrabold tracking-tight text-ink-950 md:text-[28px]">
                {provider.businessName}
                <VerificationBadge
                  status={provider.verificationStatus}
                  businessVerified={provider.businessVerified}
                  size="md"
                />
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {hasSummary && (
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="flex items-center gap-1 font-bold tabular text-ink-950">
                      <Star className="h-4 w-4 fill-rating-400 text-rating-400" aria-hidden="true" />
                      {Number(reviewSummary.overall).toFixed(1)}
                    </span>
                    <span className="text-ink-500">({reviewSummary.count} reviews)</span>
                  </span>
                )}
                {fullName && <span className="text-sm text-ink-500">{fullName}</span>}
              </div>

              <div className="mt-2.5">
                <VerificationLabel
                  status={provider.verificationStatus}
                  businessVerified={provider.businessVerified}
                />
              </div>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <FavoriteButton providerId={provider.id} />
            <MessageProviderButton
              providerId={provider.id}
              providerName={provider.businessName}
              className="btn-secondary"
              label="Message"
            />
            <Link href={`/requests/new?providerId=${provider.id}`} className="btn-primary">
              Request service
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {provider.description && (
            <section className="surface-card p-5 sm:p-6">
              <h2 className="card-title">About</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{provider.description}</p>
            </section>
          )}

          <section className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="card-title">Services</h2>
              {provider.services?.length > 0 && (
                <span className="text-xs text-ink-400">
                  {provider.services.length} listed
                </span>
              )}
            </div>

            {provider.services?.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {provider.services.map((offering: any) => (
                  <Link
                    key={offering.id}
                    href={`/service-offerings/${offering.id}`}
                    className="group flex flex-col rounded-lg border border-ink-200 bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                  >
                    <p className="text-sm font-bold text-ink-950 group-hover:text-brand-700">
                      {offering.title || offering.service.name}
                    </p>
                    {offering.service.category?.name && (
                      <p className="mt-0.5 text-xs text-ink-500">{offering.service.category.name}</p>
                    )}

                    {offering.basePrice != null && (
                      <p className="mt-2.5 text-sm font-bold tabular text-ink-950">
                        {offering.priceType === 'STARTING_FROM' && (
                          <span className="mr-1 text-xs font-medium text-ink-400">From</span>
                        )}
                        {Number(offering.basePrice).toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-ink-500">{offering.currency}</span>
                      </p>
                    )}

                    {offering.attributeValues?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
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
              <p className="text-sm text-ink-400">No services listed yet.</p>
            )}
          </section>

          <section className="surface-card p-5 sm:p-6">
            <h2 className="card-title mb-4">Portfolio</h2>
            <PortfolioGallery projects={provider.portfolios ?? []} />
          </section>

          <section className="surface-card p-5 sm:p-6">
            <h2 className="card-title mb-4">Reviews</h2>

            {hasSummary && (
              <div className="mb-6 rounded-lg border border-ink-200 bg-ink-50/60 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-extrabold tabular text-ink-950">
                      {Number(reviewSummary.overall).toFixed(1)}
                    </span>
                    <span className="text-sm text-ink-500">out of 5</span>
                  </span>
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
                  {reviewSummary.verifiedCount > 0 && (
                    <span className="badge badge-success">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                      {reviewSummary.verifiedCount} verified bookings
                    </span>
                  )}
                </div>
                <RatingBars breakdown={reviewSummary.breakdown} />
              </div>
            )}

            {provider.reviews?.length ? (
              <ul className="divide-y divide-ink-100">
                {provider.reviews.map((r: any) => (
                  <li key={r.id} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="text-sm font-bold text-ink-900">
                        {r.client?.user?.firstName} {r.client?.user?.lastName}
                      </span>
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 fill-rating-400 text-rating-400" aria-hidden="true" />
                        <span className="font-bold tabular text-ink-800">{r.rating}</span>
                      </span>
                      {r.verifiedBooking && (
                        <span className="badge badge-success">
                          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                          Verified booking
                        </span>
                      )}
                    </div>

                    {r.comment && <p className="mt-2 text-sm leading-relaxed text-ink-600">{r.comment}</p>}

                    {r.images?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.images.map((img: any) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={img.id}
                            src={img.url}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-inset ring-ink-200"
                          />
                        ))}
                      </div>
                    )}

                    {r.providerResponse && (
                      <div className="mt-3 rounded-lg border-l-2 border-brand-300 bg-brand-50/60 p-3.5 text-sm">
                        <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-brand-700">
                          Response from {provider.businessName}
                        </p>
                        <p className="leading-relaxed text-ink-700">{r.providerResponse.text}</p>
                      </div>
                    )}

                    <div className="mt-2.5">
                      <ReportButton targetType="REVIEW" targetId={r.id} label="Report review" />
                    </div>
                  </li>
                ))}
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
        <aside className="hidden space-y-4 lg:block">
          <div className="surface-card sticky top-24 space-y-4 p-5">
            <div>
              <h3 className="card-title">At a glance</h3>
              <ul className="mt-3.5 space-y-3 text-sm">
                <li className="flex items-start gap-2.5 text-ink-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  {provider.location?.city ?? 'Location not set'}
                </li>
                <li className="flex items-start gap-2.5 text-ink-700">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  <AvailabilityBadge availability={provider.availability} />
                </li>
                <li className="flex items-start gap-2.5 text-ink-700">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                  {provider.yearsOfExperience} years of experience
                </li>
                {provider.responseTimeMinutes != null && (
                  <li className="flex items-start gap-2.5 text-ink-700">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                    Replies in ~{provider.responseTimeMinutes} min
                  </li>
                )}
              </ul>
            </div>

            <div className="section-divider" />
            <ServesYourAreaCheck providerId={provider.id} />

            <div className="space-y-2 pt-1">
              <Link href={`/requests/new?providerId=${provider.id}`} className="btn-primary w-full">
                Request service
              </Link>
              <MessageProviderButton
                providerId={provider.id}
                providerName={provider.businessName}
                className="btn-secondary w-full"
                label="Send a message"
              />
              <div className="pt-1">
            <FavoriteButton providerId={provider.id} className="btn-secondary shrink-0" />
              </div>
            </div>
          </div>

          {provider.location?.latitude != null && provider.location?.longitude != null && (
            <div className="surface-card p-5">
              <h3 className="card-title mb-3">Location &amp; coverage</h3>
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <ProviderLocationMap
                  latitude={provider.location.latitude}
                  longitude={provider.location.longitude}
                  serviceAreas={provider.serviceAreas}
                />
              </div>
              {provider.serviceAreas?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-ink-500">
                  {provider.serviceAreas.map((a: any) => (
                    <li key={a.id}>
                      {a.label ?? 'Coverage area'} — {a.radiusKm} km radius
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {provider.availability?.weekly && (
            <div className="surface-card p-5">
              <h3 className="card-title mb-3">Weekly hours</h3>
              <dl className="space-y-1.5 text-xs">
                {provider.availability.weekly.map((d: any) => (
                  <div key={d.dayOfWeek} className="flex justify-between gap-3">
                    <dt className="font-medium text-ink-600">{d.day}</dt>
                    <dd className={d.hours === 'Unavailable' ? 'text-ink-300' : 'font-semibold text-ink-800'}>
                      {d.hours}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="px-1">
            <ReportButton targetType="PROVIDER" targetId={provider.id} label="Report this provider" />
          </div>
        </aside>
      </div>

      {/* Mobile sticky action bar — above the mobile tab bar. */}
      <div className="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-20 flex gap-2 border-t border-ink-200 bg-white/95 p-3 backdrop-blur-xl md:hidden">
        <MessageProviderButton
          providerId={provider.id}
          providerName={provider.businessName}
          className="btn-secondary flex-1"
          label="Message"
        />
        <Link
          href={`/requests/new?providerId=${provider.id}`}
          className="btn-primary flex-[1.4]"
        >
          Request service
        </Link>
      </div>
    </main>
  );
}
