'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, Plus, Scale } from 'lucide-react';
import { disputesApi, ApiError } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

// Disputes carry their own lifecycle (see apps/api/src/disputes/dispute-status.ts)
// that doesn't line up 1:1 with the marketplace status map, so the tones live
// here rather than growing the shared badge.
const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-warning-50 text-warning-700',
  RESPONDED: 'bg-info-50 text-info-700',
  UNDER_REVIEW: 'bg-brand-50 text-brand-700',
  RESOLVED: 'bg-success-50 text-success-700',
  REJECTED: 'bg-ink-100 text-ink-500',
};

export default function MyDisputesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    disputesApi
      .mine()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your disputes'))
      .finally(() => setLoading(false));
  }, []);

  const open = items.filter((d) => d.status === 'OPEN' || d.status === 'RESPONDED' || d.status === 'UNDER_REVIEW');

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Account"
        title="Disputes"
        description="Problems reported on your bookings, and ones reported about you."
        actions={
          <Link href="/disputes/new" className="btn-secondary">
            <Plus className="h-4 w-4" aria-hidden="true" /> Report a problem
          </Link>
        }
      />

      {loading && <LoadingBlock label="Loading your disputes…" />}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={Scale}
          title="No disputes"
          body="If something goes wrong on a booking, open a dispute from the booking itself and both sides get a structured place to sort it out."
        />
      )}

      {!loading && !error && items.length > 0 && open.length > 0 && (
        <p className="mb-3 text-xs text-ink-500">
          {open.length} of {items.length} still being worked through.
        </p>
      )}

      <ul className="space-y-3">
        {items.map((d) => (
          <li key={d.id}>
            <Link
              href={`/disputes/${d.id}`}
              className="surface-card-interactive group flex items-start justify-between gap-4 p-4 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-ink-950 group-hover:text-brand-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning-500" aria-hidden="true" />
                  <span className="truncate">{d.reason}</span>
                </p>
                <p className="mt-1.5 text-xs text-ink-500">
                  Opened {new Date(d.createdAt).toLocaleDateString()} ·{' '}
                  {d.category.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <span className={`badge shrink-0 ${STATUS_STYLES[d.status] ?? 'bg-ink-100 text-ink-600'}`}>
                {d.status.replace(/_/g, ' ').toLowerCase()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
