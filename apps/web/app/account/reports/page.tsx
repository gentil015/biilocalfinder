'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Flag, ShieldCheck } from 'lucide-react';
import { reportsApi, ApiError } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

const STATUS_TONE: Record<string, string> = {
  OPEN: 'badge-warning',
  UNDER_REVIEW: 'badge-info',
  RESOLVED: 'badge-success',
  DISMISSED: 'badge-neutral',
};

const TARGET_LABEL: Record<string, string> = {
  USER: 'User',
  PROVIDER: 'Provider',
  MESSAGE: 'Message',
  BOOKING: 'Booking',
  REVIEW: 'Review',
  SERVICE_OFFERING: 'Service',
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

export default function AccountReportsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi
      .mine()
      .then(setItems)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your reports'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Account"
        title="My reports"
        description="Reports you have sent to the trust and safety team, and how each one was handled."
        actions={
          <Link href="/account" className="btn-secondary btn-sm">
            Back to account
          </Link>
        }
      />

      {loading && <LoadingBlock label="Loading your reports…" />}

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="No reports"
          body="Reports you submit from a provider profile, review, or message will appear here."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((report) => (
            <li key={report.id} className="surface-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                    <Flag className="h-4 w-4 shrink-0 text-danger-500" aria-hidden="true" />
                    <span className="truncate">{report.reason}</span>
                  </p>
                  <p className="mt-1.5 text-xs text-ink-500">
                    {TARGET_LABEL[report.targetType] ?? report.targetType.replace(/_/g, ' ')} ·{' '}
                    {report.category.replace(/_/g, ' ').toLowerCase()} ·{' '}
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                  {report.details && (
                    <p className="mt-2 text-xs leading-relaxed text-ink-600">{report.details}</p>
                  )}
                </div>
                <span className={`badge shrink-0 ${STATUS_TONE[report.status] ?? 'badge-neutral'}`}>
                  {statusLabel(report.status)}
                </span>
              </div>

              {report.resolution && (
                <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50/60 p-3">
                  <p className="text-2xs font-bold uppercase tracking-wider text-ink-500">Outcome</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-700">{report.resolution}</p>
                </div>
              )}

              {report.status === 'RESOLVED' || report.status === 'DISMISSED' ? (
                <p className="mt-3 text-2xs text-ink-400">
                  Closed {report.resolvedAt ? new Date(report.resolvedAt).toLocaleDateString() : ''}
                </p>
              ) : (
                <p className="mt-3 text-2xs text-ink-400">
                  Our team is reviewing this report. You will see the outcome here.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
