'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { ApiError, workspacesApi, type WorkspaceAuditEntry } from '@/lib/api';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function WorkspaceAuditPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [entries, setEntries] = useState<WorkspaceAuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    workspacesApi
      .listAudit(workspaceId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load the audit log');
          setEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (!entries) return <LoadingBlock label="Loading the audit log…" />;

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Audit log"
        description="A record of membership, invitation, assignment, and workspace changes. Only owners and managers can view it."
      />

      {error ? (
        <EmptyState icon={History} title="Audit log unavailable" body={error} />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No activity yet" body="Workspace changes will appear here." />
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-ink-100">
            {entries.map((entry) => (
              <li key={entry.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950">{formatAction(entry.action)}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {entry.actor
                        ? `${entry.actor.firstName} ${entry.actor.lastName}`.trim() || entry.actor.email
                        : 'System'}{' '}
                      · {entry.entity}
                      {entry.entityId ? ` · ${entry.entityId}` : ''}
                    </p>
                  </div>
                  <time className="shrink-0 text-2xs text-ink-400" dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-2xs font-semibold text-ink-500">Details</summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-50 p-3 text-2xs text-ink-600">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
