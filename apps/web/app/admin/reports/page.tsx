'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Flag, MessageSquareWarning, ShieldAlert, User, Check } from 'lucide-react';
import { adminReportsApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

const STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];

const CATEGORY_LABEL: Record<string, string> = {
  FRAUD_OR_SCAM: 'Fraud or scam',
  FAKE_LISTING: 'Fake listing',
  IMPERSONATION: 'Impersonation',
  MISLEADING_PRICE: 'Misleading price',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  HARASSMENT: 'Harassment',
  FAKE_REVIEW: 'Fake review',
  OTHER: 'Other',
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

export default function AdminReportsPage() {
  const [status, setStatus] = useState('OPEN');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminReportsApi
      .list({ status })
      .then(setData)
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    load();
  }, [status]);

  async function resolve(id: string, dismiss: boolean) {
    setError(null);
    try {
      await adminReportsApi.resolve(id, { resolution: resolution.trim() || undefined, dismiss });
      setExpanded(null);
      setResolution('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve report');
    }
  }

  const items: any[] = data?.items ?? [];
  const countTarget = (target: string) => items.filter((r) => r.targetType === target).length;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Moderation"
        title="Reports"
        description="User-submitted reports about providers, reviews, and listings. Newest first — decide the ones that are still protecting a live listing first."
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter reports by status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`chip-interactive ${status === s ? 'chip-active' : ''}`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {!loading && items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Flag}
            label="In queue"
            tone={status === 'OPEN' ? 'warning' : 'neutral'}
            value={String(data?.total ?? items.length)}
            sub={statusLabel(status)}
          />
          <StatCard icon={ShieldAlert} label="Against providers" value={String(countTarget('PROVIDER'))} sub="On this page" />
          <StatCard icon={User} label="Against users" value={String(countTarget('USER'))} sub="On this page" />
          <StatCard
            icon={MessageSquareWarning}
            label="Against reviews"
            value={String(countTarget('REVIEW'))}
            sub="On this page"
          />
        </div>
      )}

      {loading && <LoadingBlock label="Loading reports…" />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={Flag}
          title={`Nothing ${statusLabel(status)}`}
          body="No reports are waiting in this state. Try another status above."
        />
      )}

      {!loading && items.length > 0 && (
        <Panel bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Report</th>
                  <th scope="col" className="w-28">
                    Target
                  </th>
                  <th scope="col">Reporter</th>
                  <th scope="col" className="w-32">
                    Reported
                  </th>
                  <th scope="col" className="w-28">
                    Status
                  </th>
                  <th scope="col" className="w-32 text-right">
                    <span className="sr-only">Handle</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((r: any) => {
                  const open = r.status !== 'RESOLVED' && r.status !== 'DISMISSED';
                  return (
                    <tr key={r.id}>
                      <td className="max-w-[22rem]">
                        <p className="truncate text-sm font-semibold text-ink-950">
                          {CATEGORY_LABEL[r.category] ?? r.category.replace(/_/g, ' ').toLowerCase()}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{r.reason}</p>
                        {r.details && (
                          <p className="mt-1 line-clamp-2 text-xs text-ink-400">{r.details}</p>
                        )}
                      </td>
                      <td>
                        <span className="chip px-2 py-0.5 text-2xs font-semibold">
                          {TARGET_LABEL[r.targetType] ?? r.targetType}
                        </span>
                      </td>
                      <td className="text-xs text-ink-600">
                        <span className="block truncate">
                          {r.reporter.firstName} {r.reporter.lastName}
                        </span>
                        <span className="block truncate text-ink-400">{r.reporter.email}</span>
                      </td>
                      <td className="whitespace-nowrap tabular text-xs text-ink-500">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-right">
                        {open ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                            aria-expanded={expanded === r.id}
                            aria-controls={`resolve-${r.id}`}
                            className="btn-secondary btn-sm"
                          >
                            {expanded === r.id ? 'Close' : 'Handle'}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-400">
                            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Closed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {/* The resolution form spans the table so an admin can read the
                    report and write the outcome without losing their place. */}
                {expanded &&
                  items
                    .filter((r) => r.id === expanded)
                    .map((r) => (
                      <tr key={`${r.id}-resolve`}>
                        <td id={`resolve-${r.id}`} colSpan={6} className="bg-ink-50/60">
                          <div className="max-w-2xl py-1">
                            <div className="field mb-3">
                              <label className="label" htmlFor={`resolution-${r.id}`}>
                                Resolution notes
                              </label>
                              <textarea
                                id={`resolution-${r.id}`}
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                placeholder="Optional — what you actioned, or why you dismissed it"
                                rows={2}
                              />
                            </div>
                            {error && (
                              <p className="error-text mb-3" role="alert">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {error}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => resolve(r.id, false)}
                                className="btn-primary btn-sm"
                              >
                                Mark resolved
                              </button>
                              <button
                                type="button"
                                onClick={() => resolve(r.id, true)}
                                className="btn-secondary btn-sm"
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}
