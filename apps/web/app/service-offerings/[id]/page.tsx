import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BadgeCheck, ChevronRight, Clock, MapPin, Star } from 'lucide-react';
import { offeringsApi } from '@/lib/api';
import { Panel } from '@/components/ui/page';

export const dynamic = 'force-dynamic';

function displayValue(v: any): string | null {
  if (v.booleanValue !== null) return v.booleanValue ? 'Yes' : 'No';
  if (v.jsonValue?.length) return v.jsonValue.join(', ');
  if (v.numberValue !== null) return String(v.numberValue);
  return v.textValue ?? null;
}

const PRICE_SUFFIX: Record<string, string> = {
  HOURLY: 'per hour',
  PER_DAY: 'per day',
};

export default async function ServiceOfferingPage({ params }: { params: { id: string } }) {
  let offering: any;
  try {
    offering = await offeringsApi.getPublic(params.id);
  } catch {
    notFound();
  }

  const provider = offering.provider;
  const providerImage = provider.logoUrl ?? provider.user?.avatarUrl ?? null;
  const verified = provider.verificationStatus === 'VERIFIED';
  const requestHref = `/requests/new?providerId=${provider.id}&serviceOfferingId=${offering.id}&serviceId=${offering.service.id}`;

  const attributes = (offering.attributeValues ?? [])
    .map((v: any) => ({ id: v.id, label: v.categoryAttribute?.name, display: displayValue(v) }))
    .filter((a: any) => a.display !== null && a.label);

  return (
    <main className="page-narrow py-8 pb-28 md:pb-10">
      {/* Provider identity leads, because trust is the reason someone books a
          specific provider rather than a generic listing. */}
      <Link href={`/providers/${provider.id}`} className="group flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-200 text-sm font-bold text-ink-500">
          {providerImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={providerImage}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            provider.businessName?.charAt(0).toUpperCase()
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink-950 group-hover:text-brand-700">
            <span className="truncate">{provider.businessName}</span>
            {verified && (
              <>
                <BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span className="sr-only">Verified provider</span>
              </>
            )}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
            View profile
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </span>
      </Link>

      <h1 className="page-title mt-6">{offering.title || offering.service?.name}</h1>
      {offering.service?.category?.name && (
        <p className="mt-1.5 text-sm font-medium text-ink-500">{offering.service.category.name}</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-600">
        {offering.duration && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-ink-400" aria-hidden="true" />
            {offering.duration}
          </span>
        )}
        {provider.location?.city && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-ink-400" aria-hidden="true" />
            {provider.location.city}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="flex items-center gap-0.5" aria-hidden="true">
            <Star className="h-4 w-4 fill-rating-400 text-rating-400" />
          </span>
          <span className="tabular font-bold text-ink-900">
            {Number(provider.rating).toFixed(1)}
          </span>
          <span className="sr-only">out of 5</span>
        </span>
      </div>

      {offering.basePrice != null && (
        <div className="mt-6 rounded-xl border border-ink-200 bg-surface p-5 shadow-xs">
          <p className="eyebrow-muted">
            {offering.priceType === 'STARTING_FROM' ? 'Starting from' : 'Price'}
          </p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tabular tracking-tight text-ink-950">
            {Number(offering.basePrice).toLocaleString()}
            <span className="ml-1.5 text-sm font-bold text-ink-400">{offering.currency}</span>
            {PRICE_SUFFIX[offering.priceType] && (
              <span className="ml-2 font-sans text-sm font-semibold text-ink-500">
                {PRICE_SUFFIX[offering.priceType]}
              </span>
            )}
          </p>
        </div>
      )}

      {offering.description && (
        <p className="prose-copy mt-6 whitespace-pre-line">{offering.description}</p>
      )}

      {attributes.length > 0 && (
        <Panel title="Details" className="mt-7">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {attributes.map((a: any) => (
              <div
                key={a.id}
                className="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-2.5"
              >
                <dt className="text-xs text-ink-500">{a.label}</dt>
                <dd className="text-right text-xs font-bold text-ink-900">{a.display}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}

      <div className="mt-8 hidden md:block">
        <Link href={requestHref} className="btn-primary btn-lg">
          Request this service
        </Link>
        <p className="mt-3 text-xs text-ink-500">
          Sending a request is free. The provider will quote before anything is agreed.
        </p>
      </div>

      {/* Mobile keeps the primary action pinned in reach at all times. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-surface/90 p-3 backdrop-blur-xl md:hidden">
        <Link href={requestHref} className="btn-primary btn-lg w-full">
          Request this service
        </Link>
      </div>
    </main>
  );
}
