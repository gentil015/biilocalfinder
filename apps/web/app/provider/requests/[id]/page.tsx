'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertCircle, Globe, Lock } from 'lucide-react';
import { requestsApi, quotesApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { QuoteThread } from '@/components/quote-thread';
import { SendQuoteForm } from '@/components/send-quote-form';
import { WorkspaceAssignment } from '@/components/workspace-assignment';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

export default function ProviderRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [req, qs] = await Promise.all([requestsApi.getOne(id), quotesApi.forRequest(id)]);
      setRequest(req);
      setQuotes(qs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load this request');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading request…" />
      </main>
    );

  if (error || !request)
    return (
      <main className="page-narrow py-6 md:py-8">
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error ?? 'Not found'}
        </div>
      </main>
    );

  const myQuote = quotes[0]; // one quote per provider per request in this flow

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Incoming request"
        title={request.title}
        description={
          request.service?.name || request.client?.user
            ? `${request.service?.name ?? ''}${request.service?.name && request.client?.user ? ' · ' : ''}${
                request.client?.user ? `${request.client.user.firstName} ${request.client.user.lastName}` : ''
              }`
            : undefined
        }
        actions={<StatusBadge status={request.status} />}
      />

      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
        {request.isPublic ? (
          <>
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Open to other providers too — matching providers can submit competing quotes. You and the
            client see every quote; other providers only see their own.
          </>
        ) : request.providerId ? (
          <>
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Sent directly to you — only you and the client can see this request and its quotes.
          </>
        ) : (
          <>
            <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Open request — any provider of this service can quote.
          </>
        )}
      </p>

      <Panel title="Details" className="mb-8">
        <p className="prose-copy">{request.description}</p>

        {(request.budgetMin || request.budgetMax || request.attributeSnapshots?.length > 0) && (
          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-ink-100 pt-5 sm:grid-cols-2">
            {(request.budgetMin || request.budgetMax) && (
              <div className="detail-row border-0 py-0">
                <dt className="detail-key">Client budget</dt>
                <dd className="detail-value">
                  {request.budgetMin ?? '—'} – {request.budgetMax ?? '—'}
                  <span className="ml-1 text-xs font-medium text-ink-400">RWF</span>
                </dd>
              </div>
            )}
            {request.attributeSnapshots?.map((a: any) => (
              <div key={a.id} className="detail-row border-0 py-0">
                <dt className="detail-key">{a.attributeName}</dt>
                <dd className="detail-value">{a.attributeValue}</dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <WorkspaceAssignment
        resource="request"
        resourceId={request.id}
        providerId={request.providerId}
        assignedMembershipId={request.assignedMembershipId}
        assignedMembership={request.assignedMembership}
        onAssigned={load}
      />

      {!myQuote ? (
        <SendQuoteForm requestId={request.id} onSent={load} />
      ) : (
        <QuoteThread quote={myQuote} viewerRole="PROVIDER" onChanged={load} />
      )}
    </main>
  );
}