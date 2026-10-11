'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Globe,
  Inbox,
  Lock,
  MessageSquare,
  Wallet,
} from 'lucide-react';
import { requestsApi, quotesApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { QuoteThread } from '@/components/quote-thread';
import { EmptyState, PageHeader, Panel, Skeleton } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';

function budgetRange(request: any): string | null {
  const min = request.budgetMin;
  const max = request.budgetMax;
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${Number(min).toLocaleString()} – ${Number(max).toLocaleString()} RWF`;
  if (max != null) return `Up to ${Number(max).toLocaleString()} RWF`;
  return `From ${Number(min).toLocaleString()} RWF`;
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

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

  if (loading) {
    return (
      <main className="page-narrow py-8">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Panel className="mt-8 p-6">
          <Skeleton className="h-20 w-full" />
        </Panel>
        <Panel className="mt-5 p-6">
          <Skeleton className="h-40 w-full" />
        </Panel>
      </main>
    );
  }

  if (error || !request) {
    return (
      <main className="page-narrow py-8">
        <EmptyState
          icon={Inbox}
          title="We couldn't load this request"
          body={error ?? 'Not found'}
          action={
            <Link href="/requests" className="btn-secondary btn-sm">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to requests
            </Link>
          }
        />
      </main>
    );
  }

  const budget = budgetRange(request);
  const attributes = request.attributeSnapshots ?? [];
  // The client can open/close the competition while the request still
  // accepts quotes; a booked or cancelled request is frozen.
  const privacyEditable = ['OPEN', 'QUOTED', 'NEGOTIATING'].includes(request.status);

  function togglePrivacy() {
    if (toggling) return;
    setToggling(true);
    setError(null);
    requestsApi
      .setPrivacy(id, !request.isPublic)
      .then((updated) => setRequest(updated))
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : 'Could not update privacy'),
      )
      .finally(() => setToggling(false));
  }

  return (
    <main className="page-narrow py-8">
      <BackButton variant="link" label="All requests" fallbackHref="/requests" />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{request.title}</h1>
          <p className="mt-1.5 text-sm font-medium text-ink-500">{request.service?.name}</p>
          {request.provider &&
            (request.isPublic ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Open to other providers — {request.provider.businessName} got this request first; other
                matching providers can also send quotes.
              </p>
            ) : (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Private request — only {request.provider.businessName} can see it and send a quote
              </p>
            ))}
          {request.provider && privacyEditable && (
            <button
              type="button"
              disabled={toggling}
              onClick={togglePrivacy}
              className="btn-secondary btn-sm mt-2 inline-flex items-center gap-1.5"
            >
              {request.isPublic ? (
                <>
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {toggling ? 'Updating…' : 'Keep private'}
                </>
              ) : (
                <>
                  <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                  {toggling ? 'Updating…' : 'Open to other providers'}
                </>
              )}
            </button>
          )}
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* The brief the providers actually read, so it gets a full panel with
          the structured details set apart from the free text. */}
      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="card-title">Your request</h2>
        <p className="prose-copy mt-3 whitespace-pre-line">{request.description}</p>

        {(budget ||
          request.preferredDate ||
          request.additionalNotes ||
          attributes.length > 0) && (
          <div className="mt-5 space-y-4 border-t border-ink-100 pt-5">
            {budget && (
              <div className="flex items-start gap-2.5">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <div>
                  <p className="text-xs text-ink-500">Budget</p>
                  <p className="tabular text-sm font-bold text-ink-950">{budget}</p>
                </div>
              </div>
            )}

            {request.preferredDate && (
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <div>
                  <p className="text-xs text-ink-500">Preferred</p>
                  <p className="text-sm font-semibold text-ink-900">
                    {new Date(request.preferredDate).toLocaleDateString()}
                    {request.preferredTime && (
                      <span className="ml-1.5 font-normal text-ink-500">
                        at <Clock className="inline h-3 w-3" aria-hidden="true" /> {request.preferredTime}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {request.additionalNotes && (
              <div>
                <p className="text-xs text-ink-500">Notes</p>
                <p className="prose-copy mt-0.5">{request.additionalNotes}</p>
              </div>
            )}

            {attributes.length > 0 && (
              <div>
                <p className="text-xs text-ink-500">Job details</p>
                <dl className="mt-2 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {attributes.map((a: any) => (
                    <div key={a.id} className="flex items-baseline justify-between gap-3 border-b border-ink-100 pb-2">
                      <dt className="text-xs text-ink-500">{a.attributeName}</dt>
                      <dd className="text-right text-xs font-semibold text-ink-900">{a.attributeValue}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Quotes. Client-side they arrive in whatever order the API returns,
          so pending-and-actionable first is a real usability gain. */}
      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="section-title">Quotes</h2>
        {quotes.length > 0 && (
          <span className="text-sm font-semibold text-ink-400">
            {quotes.length} {quotes.length === 1 ? 'offer' : 'offers'}
          </span>
        )}
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={MessageSquare}
          title="No quotes yet"
          body={
            request.provider
              ? request.isPublic
                ? `${request.provider.businessName} got this request first. This request is open to other matching providers — every quote lands here, and you'll see them side by side.`
                : `This request was sent privately to ${request.provider.businessName}. Their quote will appear here and stays between the two of you.`
              : "Providers who match this request will send their quotes here. You'll be notified as soon as the first one lands."
          }
        />
      ) : (
        <div className="mt-4 space-y-4">
          {quotes.map((q) => (
            <QuoteThread
              key={q.id}
              quote={q}
              viewerRole="CLIENT"
              onChanged={load}
              onAccepted={(booking) => router.push(`/bookings/${booking.id}`)}
            />
          ))}
        </div>
      )}
    </main>
  );
}
