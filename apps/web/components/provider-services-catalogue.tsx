'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  Clock,
  ImageIcon,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';

type Offering = {
  id: string;
  title?: string | null;
  description?: string | null;
  basePrice?: number | string | null;
  priceType?: string | null;
  currency?: string | null;
  duration?: string | null;
  availabilityNote?: string | null;
  images?: Array<{ id: string; url: string }>;
  service?: { name?: string | null; category?: { name?: string | null } | null } | null;
  attributeValues?: Array<{
    id: string;
    booleanValue?: boolean | null;
    jsonValue?: string[] | null;
    textValue?: string | null;
    numberValue?: number | null;
    categoryAttribute?: { name?: string | null } | null;
  }>;
};

const PRICE_LABEL: Record<string, string> = {
  FIXED: 'Fixed price',
  HOURLY: 'Per hour',
  PER_DAY: 'Per day',
  STARTING_FROM: 'Starting from',
  CUSTOM_QUOTE: 'Custom quote',
};

function priceLabel(offering: Offering) {
  const type = offering.priceType ?? 'FIXED';
  if (type === 'CUSTOM_QUOTE' || offering.basePrice == null) return 'Request a quote';
  const amount = Number(offering.basePrice).toLocaleString();
  const currency = offering.currency ?? 'RWF';
  if (type === 'STARTING_FROM') return `From ${amount} ${currency}`;
  if (type === 'HOURLY') return `${amount} ${currency}/hr`;
  if (type === 'PER_DAY') return `${amount} ${currency}/day`;
  return `${amount} ${currency}`;
}

function attrLabel(v: NonNullable<Offering['attributeValues']>[number]) {
  if (v.booleanValue === true) return v.categoryAttribute?.name ?? null;
  if (v.booleanValue === false) return null;
  if (v.jsonValue?.length) return v.jsonValue.join(', ');
  if (v.textValue) return v.textValue;
  if (v.numberValue != null) return String(v.numberValue);
  return null;
}

export function ProviderServicesCatalogue({
  providerId,
  providerName,
  services,
}: {
  providerId: string;
  providerName: string;
  services: Offering[];
}) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((o) => {
      const haystack = [
        o.title,
        o.service?.name,
        o.service?.category?.name,
        o.description,
        o.duration,
        ...(o.attributeValues ?? []).map((v) => attrLabel(v)),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, services]);

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100">
            <Wrench className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Catalogue</p>
            <h2 className="card-title mt-0.5">Services by {providerName}</h2>
          </div>
        </div>
        <span className="chip w-fit py-1 text-2xs">{services.length} listed</span>
      </div>

      {services.length > 4 && (
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services..."
            aria-label="Search services"
            className="w-full rounded-xl border border-ink-200 bg-surface py-2.5 pl-9 pr-9 text-sm text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((offering) => {
            const expanded = expandedId === offering.id;
            const name = offering.title || offering.service?.name || 'Service';
            const attrs = (offering.attributeValues ?? []).map((v) => ({ id: v.id, label: attrLabel(v) })).filter((v) => v.label);
            const visibleAttrs = expanded ? attrs : attrs.slice(0, 3);
            const image = offering.images?.[0]?.url;
            const bookHref = `/requests/new?providerId=${providerId}&serviceOfferingId=${offering.id}${offering.service ? `&serviceId=${(offering as any).serviceId ?? ''}` : ''}`;

            return (
              <article
                key={offering.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-surface transition duration-200 hover:border-brand-300 hover:shadow-lg"
              >
                {image ? (
                  <div className="relative h-36 overflow-hidden bg-ink-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/35 to-transparent" />
                  </div>
                ) : (
                  <div className="flex h-20 items-center justify-center bg-gradient-to-br from-brand-50 to-ink-50 text-brand-300">
                    <ImageIcon className="h-6 w-6" aria-hidden="true" />
                  </div>
                )}

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold tracking-tight text-ink-950">{name}</p>
                      {offering.service?.category?.name && (
                        <p className="mt-0.5 text-xs font-medium text-ink-500">{offering.service.category.name}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-2xs font-bold text-brand-700 ring-1 ring-inset ring-brand-100">
                      {PRICE_LABEL[offering.priceType ?? 'FIXED'] ?? 'Service'}
                    </span>
                  </div>

                  <p className="mt-3 text-lg font-extrabold tabular tracking-tight text-ink-950">
                    {priceLabel(offering)}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                    {offering.duration && (
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{offering.duration}</span>
                    )}
                    {offering.availabilityNote && (
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{offering.availabilityNote}</span>
                    )}
                  </div>

                  {!expanded && offering.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-600">{offering.description}</p>
                  )}

                  {expanded && (
                    <div className="mt-3 space-y-3 border-t border-ink-100 pt-3">
                      {offering.description && <p className="text-sm leading-relaxed text-ink-600 whitespace-pre-line">{offering.description}</p>}
                      {offering.availabilityNote && (
                        <div className="rounded-lg bg-brand-50/60 px-3 py-2 text-xs text-brand-800">
                          <span className="font-semibold">Availability: </span>{offering.availabilityNote}
                        </div>
                      )}
                    </div>
                  )}

                  {visibleAttrs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {visibleAttrs.map((v) => (
                        <span key={v.id} className="chip py-0.5 text-2xs font-medium">{v.label}</span>
                      ))}
                      {!expanded && attrs.length > 3 && (
                        <span className="chip py-0.5 text-2xs font-medium text-ink-400">+{attrs.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2 border-t border-ink-100 pt-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : offering.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-ink-600 hover:text-brand-700"
                    >
                      {expanded ? 'Show less' : 'View details'}
                      <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>
                    <div className="ml-auto flex gap-2">
                      <Link href={`/service-offerings/${offering.id}`} className="btn-secondary btn-sm">
                        Details
                      </Link>
                      <Link href={bookHref} className="btn-primary btn-sm">
                        Book
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state py-10">
          {query ? <Search className="h-5 w-5 text-ink-300" aria-hidden="true" /> : <Wrench className="h-5 w-5 text-ink-300" aria-hidden="true" />}
          <p className="mt-3 text-sm font-semibold text-ink-800">{query ? 'No services match your search' : 'No services listed yet'}</p>
          <p className="mt-1 max-w-xs text-xs text-ink-500">
            {query ? 'Try a different keyword or clear the search.' : 'When this provider publishes services, they will appear here.'}
          </p>
          {query && (
            <button type="button" onClick={() => setQuery('')} className="btn-secondary btn-sm mt-4">
              Clear search
            </button>
          )}
        </div>
      )}
    </section>
  );
}
