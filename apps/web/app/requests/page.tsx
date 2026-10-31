'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ClipboardList, AlertCircle } from 'lucide-react';
import { requestsApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { requestJourney } from '@/components/request-journey';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestsApi
      .mine()
      .then(setRequests)
      .catch(() => setError('Unable to load your requests'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Workspace"
        title="Your requests"
        description="Every service request you've posted, and where each one stands."
        actions={
          <Link href="/requests/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" /> New request
          </Link>
        }
      />

      {loading && <LoadingBlock label="Loading your requests…" />}

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="No service requests yet"
          body="Post what you need and verified providers nearby will send you quotes you can compare."
          action={
            <Link href="/requests/new" className="btn-primary btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> Post your first request
            </Link>
          }
        />
      )}

      <ul className="space-y-3">
        {requests.map((r) => {
          const journey = requestJourney(r, r.quotes ?? []);
          const quoteCount = r.quotes?.length ?? 0;

          return (
            <li key={r.id}>
              <Link
                href={`/requests/${r.id}`}
                className="surface-card-interactive group flex items-start justify-between gap-4 p-4 sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-ink-950 group-hover:text-brand-700">
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-500">{r.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-brand-700">{journey.headline}</span>
                    {quoteCount > 0 && (
                      <span className="chip py-0.5 text-2xs">
                        {quoteCount} {quoteCount === 1 ? 'quote' : 'quotes'}
                      </span>
                    )}
                    {r.service?.name && (
                      <span className="font-medium text-ink-400">{r.service.name}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-400">
                    {journey.next}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
