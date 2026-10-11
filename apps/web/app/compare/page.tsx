'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Star, ArrowRight, Scale } from 'lucide-react';
import { providersApi, ApiError } from '@/lib/api';
import { VerificationBadge } from '@/components/verification-badge';
import { AvailabilityBadge } from '@/components/availability-badge';

const ROWS: {
  key: string;
  label: string;
  /** Higher is better; used to tint the winning cell. Null when the metric
   *  isn't a "more is better" number (e.g. price). */
  better: 'higher' | 'lower' | null;
  render: (p: any) => React.ReactNode;
  value: (p: any) => number | null;
}[] = [
  {
    key: 'rating',
    label: 'Rating',
    better: 'higher',
    render: (p) => (
      <span className="flex items-center justify-center gap-1">
        <Star className="h-4 w-4 fill-rating-400 text-rating-400" aria-hidden="true" />
        <span className="font-bold tabular text-ink-950">{p.rating.toFixed(1)}</span>
        <span className="text-xs text-ink-400">({p.reviewCount})</span>
      </span>
    ),
    value: (p) => (p.rating != null ? Number(p.rating) : null),
  },
  {
    key: 'reviews',
    label: 'Reviews',
    better: 'higher',
    render: (p) => <span className="tabular">{p.reviewCount ?? '—'}</span>,
    value: (p) => (p.reviewCount != null ? Number(p.reviewCount) : null),
  },
  {
    key: 'experience',
    label: 'Experience',
    better: 'higher',
    render: (p) => (p.yearsOfExperience != null ? `${p.yearsOfExperience} yrs` : '—'),
    value: (p) => (p.yearsOfExperience != null ? Number(p.yearsOfExperience) : null),
  },
  {
    key: 'price',
    label: 'Starting price',
    better: 'lower',
    render: (p) =>
      p.startingPrice != null ? (
        <span className="font-bold tabular text-ink-950">
          {p.startingPrice.toLocaleString()}{' '}
          <span className="text-xs font-semibold text-ink-500">{p.currency}</span>
        </span>
      ) : (
        <span className="text-ink-400">Contact for pricing</span>
      ),
    value: (p) => (p.startingPrice != null ? Number(p.startingPrice) : null),
  },
  {
    key: 'verified',
    label: 'Verified',
    better: null,
    render: (p) =>
      p.verificationStatus === 'VERIFIED' ? (
        <span className="flex justify-center">
          <VerificationBadge status={p.verificationStatus} businessVerified={p.businessVerified} size="md" />
        </span>
      ) : (
        <span className="text-ink-300">—</span>
      ),
    value: (p) => (p.verificationStatus === 'VERIFIED' ? 1 : 0),
  },
  {
    key: 'response',
    label: 'Response time',
    better: 'lower',
    render: (p) => (p.responseTimeMinutes != null ? `~${p.responseTimeMinutes} min` : '—'),
    value: (p) => (p.responseTimeMinutes != null ? Number(p.responseTimeMinutes) : null),
  },
  {
    key: 'availability',
    label: 'Availability',
    better: null,
    render: (p) => (
      <span className="flex justify-center">
        <AvailabilityBadge availability={p.availability} />
      </span>
    ),
    value: (p) => (p.availability?.availableToday ? 1 : 0),
  },
];

/** Index of the provider that wins a row, so the table can highlight it. */
function bestIndex(row: (typeof ROWS)[number], providers: any[]): number | null {
  if (!row.better) return null;
  const scored = providers
    .map((p, i) => ({ i, v: row.value(p) }))
    .filter((entry): entry is { i: number; v: number } => entry.v != null);
  if (scored.length < 2) return null;
  const target = row.better === 'higher' ? Math.max(...scored.map((s) => s.v)) : Math.min(...scored.map((s) => s.v));
  const winners = scored.filter((s) => s.v === target);
  // A tie isn't a win — highlighting both defeats the purpose.
  return winners.length === 1 ? winners[0].i : null;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }
    providersApi
      .compare(ids)
      .then(setProviders)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load these providers'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  if (ids.length < 2) {
    return (
      <main className="page-narrow py-16">
        <div className="empty-state">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Scale className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-lg font-bold text-ink-950">Nothing to compare yet</h1>
          <p className="mt-1.5 max-w-sm text-sm text-ink-500">
            Select two or three providers from your search results and their quotes, ratings and
            response times will line up here.
          </p>
          <Link href="/search" className="btn-primary btn-sm mt-5">
            Browse providers <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="page-workspace py-10">
        <div className="skeleton h-8 w-52" />
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-12 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-narrow py-10">
        <div className="alert alert-error">{error}</div>
        <Link href="/search" className="btn-secondary btn-sm mt-4">
          Back to search
        </Link>
      </main>
    );
  }

  return (
    <main className="page-workspace py-6 md:py-8">
      <p className="eyebrow">Side by side</p>
      <h1 className="page-title mt-1.5">Compare providers</h1>
      <p className="mt-2 text-sm text-ink-500">
        {providers.length} providers. The strongest figure in each row is highlighted.
      </p>

      <div className="table-wrap mt-6 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
        <table className="table min-w-[640px] table-fixed">
          <caption className="sr-only">Comparison of selected providers</caption>
          <thead>
            <tr>
              <th scope="col" className="w-40">
                <span className="sr-only">Attribute</span>
              </th>
              {providers.map((p) => {
                const initial = p.businessName?.charAt(0)?.toUpperCase() ?? 'P';
                return (
                  <th key={p.id} scope="col" className="p-4 text-center align-bottom">
                    <Link href={`/providers/${p.id}`} className="group block">
                      <span className="mx-auto mb-2.5 block h-14 w-14 overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-brand-800">
                        {p.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-lg font-extrabold text-white">
                            {initial}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm font-bold leading-tight text-ink-950 group-hover:text-brand-700">
                        {p.businessName}
                      </span>
                      {p.city && <span className="mt-0.5 block text-2xs font-medium text-ink-400">{p.city}</span>}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {ROWS.map((row) => {
              const best = bestIndex(row, providers);
              return (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="border-b border-ink-100 bg-ink-50/60 px-4 py-3.5 text-left align-middle text-xs font-semibold text-ink-500"
                  >
                    {row.label}
                  </th>
                  {providers.map((p, idx) => (
                    <td
                      key={p.id}
                      className={`border-b border-ink-100 px-4 py-3.5 text-center align-middle text-sm ${
                        idx === best ? 'bg-success-50/70 font-semibold text-ink-900' : 'text-ink-700'
                      }`}
                    >
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <th scope="row" className="bg-ink-50/60 px-4 py-4 text-left align-middle">
                <span className="text-xs font-semibold text-ink-500">Next step</span>
              </th>
              {providers.map((p) => (
                <td key={p.id} className="px-4 py-4 text-center align-middle">
                  <Link href={`/requests/new?providerId=${p.id}`} className="btn-primary btn-sm whitespace-nowrap">
                    Request service
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <CompareContent />
    </Suspense>
  );
}
