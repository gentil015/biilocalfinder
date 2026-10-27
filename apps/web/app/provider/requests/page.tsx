'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Inbox, AlertCircle, Lock, Globe } from 'lucide-react';
import { requestsApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';
import { HelpHint } from '@/components/help-hint';

export default function IncomingRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    requestsApi
      .incoming()
      .then(setRequests)
      .catch(() => setError('Unable to load requests'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Incoming requests"
        description="Service requests that match your services, and where each one stands."
        actions={<HelpHint text="Private requests are sent only to you. Open requests can go to matching providers — send a quote to respond." />}
      />

      {loading && <LoadingBlock label="Loading requests…" />}

      {error && (
        <div className="alert alert-error">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No service requests yet"
          body="Requests are matched to the services you list. Add a service so clients can find you, then check back here to quote."
          action={
            <Link href="/provider/offerings/new" className="btn-primary btn-sm">
              Add a service
            </Link>
          }
        />
      )}

      <ul className="space-y-3">
        {requests.map((r) => (
          <li key={r.id}>
            <Link
              href={`/provider/requests/${r.id}`}
              className="surface-card-interactive group flex items-center justify-between gap-4 p-4 sm:p-5"
            >
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-ink-950 group-hover:text-brand-700">
                  {r.title}
                </h3>
                {r.description && (
                  <p className="mt-1 line-clamp-1 text-sm text-ink-500">{r.description}</p>
                )}
                <p className="mt-2 flex items-center gap-2 text-xs font-medium text-ink-400">
                  {r.providerId && !r.isPublic ? (
                    <>
                      <span className="flex items-center gap-1 font-semibold text-brand-700">
                        <Lock className="h-3 w-3" aria-hidden="true" /> Sent directly to you
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  ) : r.providerId && r.isPublic ? (
                    <>
                      <span className="flex items-center gap-1 font-semibold text-brand-700">
                        <Globe className="h-3 w-3" aria-hidden="true" /> Open to you and others
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" aria-hidden="true" /> Open request
                      </span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  {r.service?.name}
                  {r.service?.name && r.client?.user ? ' · ' : ''}
                  {r.client?.user ? `${r.client.user.firstName} ${r.client.user.lastName}` : ''}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}