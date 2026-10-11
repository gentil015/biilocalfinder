'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react';
import { offeringsApi, ApiError } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function MyOfferingsPage() {
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    offeringsApi
      .mine()
      .then(setOfferings)
      .catch(() => setError('Unable to load your services'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function remove(id: string) {
    try {
      await offeringsApi.remove(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this service');
    }
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Your services"
        description="The services clients can request and quote against. Pricing and details live here."
        actions={
          <Link href="/provider/offerings/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Add service
          </Link>
        }
      />

      {loading && <LoadingBlock label="Loading your services…" />}

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && offerings.length === 0 && (
        <EmptyState
          icon={Package}
          title="You haven't added any services yet"
          body="Add a service you provide — clients search by service, so listing the work you do is what gets you found."
          action={
            <Link href="/provider/offerings/new" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add your first service
            </Link>
          }
        />
      )}

      {!loading && !error && offerings.length > 0 && (
        <div className="table-wrap surface-card">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col" className="text-right">
                  Price
                </th>
                <th scope="col" className="w-10">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {offerings.map((o) => (
                <tr key={o.id}>
                  <td className="max-w-[16rem]">
                    <p className="truncate text-sm font-bold text-ink-900">{o.title || o.service?.name}</p>
                    {o.service?.category?.name && (
                      <p className="mt-0.5 truncate text-xs text-ink-500">{o.service.category.name}</p>
                    )}
                    {o.description && <p className="mt-1 line-clamp-1 text-xs text-ink-400">{o.description}</p>}
                    {o.attributeValues?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.attributeValues.map((v: any) => {
                          const display =
                            v.booleanValue !== null
                              ? v.booleanValue
                                ? v.categoryAttribute.name
                                : null
                              : v.jsonValue?.length
                                ? v.jsonValue.join(', ')
                                : (v.textValue ?? v.numberValue);
                          if (display == null) return null;
                          return (
                            <span key={v.id} className="chip px-2 py-0.5 text-2xs font-medium">
                              {display}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {o.basePrice != null ? (
                      <span className="text-sm font-bold tabular text-ink-900">
                        {o.priceType === 'STARTING_FROM' && (
                          <span className="mr-1 text-xs font-medium text-ink-400">From</span>
                        )}
                        {Number(o.basePrice).toLocaleString()}{' '}
                        <span className="text-xs font-semibold text-ink-500">{o.currency}</span>
                        {o.priceType === 'HOURLY' ? (
                          <span className="text-xs font-medium text-ink-500"> / hour</span>
                        ) : o.priceType === 'PER_DAY' ? (
                          <span className="text-xs font-medium text-ink-500"> / day</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-400">Quote on request</span>
                    )}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => remove(o.id)}
                      className="icon-btn"
                      aria-label={`Remove ${o.title || o.service?.name || 'service'}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}