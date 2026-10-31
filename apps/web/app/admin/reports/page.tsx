'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, Flag, MessageSquareWarning, ShieldAlert, User, Check } from 'lucide-react';
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

function targetHref(report: any): string | null {
  if (!report?.target) return null;
  if (report.targetType === 'PROVIDER') return `/providers/${report.target.id}`;
  if (report.targetType === 'REVIEW' && report.target.providerId) {
    return `/providers/${report.target.providerId}`;
  }
  if (report.targetType === 'SERVICE_OFFERING') {
    return `/service-offerings/${report.target.id}`;
  }
  return null;
}

function TargetSummary({ report }: { report: any }) {
  const target = report?.target;
  const href = targetHref(report);

  return (
    <div className="rounded-xl border border-ink-200 bg-surface p-3.5">
      <p className="eyebrow-muted mb-1.5">Reported {TARGET_LABEL[report.targetType] ?? report.targetType}</p>
      {!target ? (
        <p className="text-xs leading-relaxed text-ink-500">
          The reported content no longer exists. The report record is still available for the audit trail.
        </p>
      ) : report.targetType === 'PROVIDER' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink-900">{target.businessName}</p>
          <span className="badge badge-neutral">{statusLabel(target.verificationStatus)}</span>
        </div>
      ) : report.targetType === 'REVIEW' ? (
        <p className="text-xs leading-relaxed text-ink-600">
          {target.rating} star review · {target.comment || 'No comment'}
          {target.status === 'HIDDEN' && <span className="ml-2 badge badge-warning">Hidden</span>}
        </p>
      ) : report.targetType === 'BOOKING' ? (
        <p className="text-xs text-ink-600">Booking status: {statusLabel(target.status)}</p>
      ) : report.targetType === 'MESSAGE' ? (
        <p className="line-clamp-3 text-xs leading-relaxed text-ink-600">{target.body}</p>
      ) : report.targetType === 'SERVICE_OFFERING' ? (
        <p className="text-xs text-ink-600">
          {target.title || 'Untitled service'} · {target.isActive ? 'active' : 'inactive'}
        </p>
      ) : (
        <p className="text-xs text-ink-600">
          {target.firstName} {target.lastName} · {target.email} · {statusLabel(target.status)}
        </p>
      )}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
        >
          Open reported content
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState('OPEN');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
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

  async function toggleExpanded(id: string) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      setDetailError(null);
      return;
    }

    setExpanded(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      setDetail(await adminReportsApi.getOne(id));
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Could not load the reported content');
    } finally {
      setDetailLoading(false);
    }
  }

  async function resolve(id: string, dismiss: boolean) {
    setError(null);
    try {
      await adminReportsApi.resolve(id, { resolution: resolution.trim() || undefined, dismiss });
      setExpanded(null);
      setDetail(null);
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
                            onClick={() => void toggleExpanded(r.id)}
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
                            {detailError && (
                              <p className="error-text mb-3" role="alert">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                {detailError}
                              </p>
                            )}
                            {detailLoading ? (
                              <p className="mb-3 text-xs text-ink-500">Loading reported content…</p>
                            ) : (
                              detail?.id === r.id && <div className="mb-3"><TargetSummary report={detail} /></div>
                            )}
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
