'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { adminApi, type AdminAuditLogsPage } from '@/lib/api';
import { EmptyState, LoadingBlock, PageHeader, Panel } from '@/components/ui/page';

const PAGE_SIZE = 50;

const ACTIONS = [
  'DISPUTE_UNDER_REVIEW',
  'DISPUTE_RESOLVED',
  'PROVIDER_APPLICATION_APPROVED',
  'PROVIDER_APPLICATION_REJECTED',
  'PROVIDER_APPLICATION_SUBMITTED',
  'REPORT_DISMISSED',
  'REPORT_RESOLVED',
  'REVIEW_HIDDEN',
  'REVIEW_RESTORED',
  'USER_ACTIVATED',
  'USER_SUSPENDED',
  'VERIFICATION_APPROVED',
  'VERIFICATION_DOCUMENTS_VIEWED',
  'VERIFICATION_REINSTATED',
  'VERIFICATION_REJECTED',
  'VERIFICATION_SUSPENDED',
  'WORKSPACE_CREATED',
  'WORKSPACE_MEMBER_INVITED',
  'WORKSPACE_MEMBER_REMOVED',
  'WORKSPACE_MEMBER_ROLE_CHANGED',
  'WORKSPACE_UPDATED',
];

const ENTITIES = [
  'Dispute',
  'ProviderApplication',
  'Report',
  'Review',
  'User',
  'VerificationRecord',
  'Workspace',
  'WorkspaceMembership',
];

function humanize(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminAuditLogsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminAuditLogsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .auditLogs({ search, action: action || undefined, entity: entity || undefined, page })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load audit logs');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, action, entity, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Oversight"
        title="Audit logs"
        description="Review who performed administrative and workspace actions, what they changed, and when."
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      <Panel className="mb-5" bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_14rem_14rem]">
          <label>
            <span className="sr-only">Search audit logs</span>
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search actor, action, or target ID"
              className="w-full"
            />
          </label>
          <label>
            <span className="sr-only">Filter by action</span>
            <select
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              className="w-full"
            >
              <option value="">All actions</option>
              {ACTIONS.map((value) => (
                <option key={value} value={value}>{humanize(value)}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by entity</span>
            <select
              value={entity}
              onChange={(event) => {
                setPage(1);
                setEntity(event.target.value);
              }}
              className="w-full"
            >
              <option value="">All entity types</option>
              {ENTITIES.map((value) => (
                <option key={value} value={value}>{humanize(value)}</option>
              ))}
            </select>
          </label>
        </div>
      </Panel>

      {!loading && data && (
        <p className="mb-3 text-sm text-ink-500" aria-live="polite">
          {data.total.toLocaleString()} {data.total === 1 ? 'audit entry' : 'audit entries'}
        </p>
      )}

      {loading && <LoadingBlock label="Loading audit logs…" />}

      {!loading && data?.items.length === 0 && (
        <EmptyState
          icon={History}
          title="No audit entries found"
          body="Try a different search term or clear one of the filters."
        />
      )}

      {!loading && data && data.items.length > 0 && (
        <Panel
          title="Activity"
          description={`Page ${data.page} of ${totalPages}`}
          bodyClassName="p-0"
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col" className="w-44">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col" className="w-32">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap text-sm text-ink-600">
                      <time dateTime={entry.createdAt}>
                        {new Date(entry.createdAt).toLocaleString()}
                      </time>
                    </td>
                    <td>
                      {entry.actor ? (
                        <>
                          <span className="block font-semibold text-ink-900">
                            {entry.actor.firstName} {entry.actor.lastName}
                          </span>
                          <span className="block text-xs text-ink-500">{entry.actor.email}</span>
                        </>
                      ) : (
                        <span className="text-sm text-ink-400">Unknown actor</span>
                      )}
                    </td>
                    <td className="font-semibold text-ink-800">{humanize(entry.action)}</td>
                    <td>
                      <span className="block text-sm font-medium text-ink-800">{humanize(entry.entity)}</span>
                      {entry.entityId && (
                        <span className="block max-w-48 truncate font-mono text-xs text-ink-500" title={entry.entityId}>
                          {entry.entityId}
                        </span>
                      )}
                    </td>
                    <td>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
                        <details className="max-w-56">
                          <summary className="cursor-pointer text-sm font-semibold text-brand-700">View details</summary>
                          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-2 text-xs text-ink-700">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-xs text-ink-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="text-sm tabular text-ink-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}
