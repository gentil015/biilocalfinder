'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, BadgeCheck, AlertCircle } from 'lucide-react';
import { reviewsApi, ApiError } from '@/lib/api';
import { PageHeader, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function ProviderReviewsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    reviewsApi
      .mine({ unanswered: unansweredOnly })
      .then(setData)
      .finally(() => setLoading(false));

  useEffect(() => {
    setLoading(true);
    load();
  }, [unansweredOnly]);

  async function respond(reviewId: string) {
    const text = (drafts[reviewId] ?? '').trim();
    if (text.length < 2) return;
    setBusyId(reviewId);
    setError(null);
    try {
      await reviewsApi.respond(reviewId, text);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your response');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Your reviews"
        description={
          data
            ? `${data.total} total${data.unanswered > 0 ? ` · ${data.unanswered} awaiting a response` : ''}`
            : undefined
        }
        actions={
          <button
            onClick={() => setUnansweredOnly((v) => !v)}
            aria-pressed={unansweredOnly}
            className={`chip ${unansweredOnly ? 'chip-active' : 'chip-interactive'}`}
          >
            Unanswered only
          </button>
        }
      />

      {loading && <LoadingBlock label="Loading your reviews…" />}

      {error && (
        <div className="alert alert-error mb-4">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {!loading && !error && data?.items?.length === 0 && (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          body="Reviews appear here after clients complete a booking with you. Keep your services and availability up to date to get your first one."
          action={
            <Link href="/provider/availability" className="btn-secondary btn-sm">
              Check your availability
            </Link>
          }
        />
      )}

      <ul className="space-y-4">
        {data?.items?.map((r: any) => (
          <li key={r.id} className="surface-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span className="text-sm font-bold text-ink-900">{r.reviewer.name}</span>
              <span className="flex items-center gap-1 text-sm">
                <Star className="h-3.5 w-3.5 fill-rating-400 text-rating-400" aria-hidden="true" />
                <span className="font-bold tabular text-ink-800">{r.rating}</span>
              </span>
              {r.verifiedBooking && (
                <span className="badge badge-success">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  Verified booking
                </span>
              )}
            </div>
            {r.comment && <p className="prose-copy mt-2">{r.comment}</p>}

            {r.providerResponse ? (
              <div className="mt-3 rounded-lg border-l-2 border-brand-300 bg-brand-50/60 p-3.5 text-sm">
                <p className="mb-1 text-2xs font-bold uppercase tracking-wider text-brand-700">Your response</p>
                <p className="leading-relaxed text-ink-700">{r.providerResponse.text}</p>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <input
                  value={drafts[r.id] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Write a public response…"
                  aria-label={`Respond to ${r.reviewer.name}'s review`}
                  className="flex-1"
                />
                <button
                  onClick={() => respond(r.id)}
                  disabled={busyId === r.id}
                  className="btn-primary btn-md shrink-0"
                >
                  {busyId === r.id ? 'Sending…' : 'Send'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}