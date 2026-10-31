'use client';

import { useState } from 'react';
import { AlertCircle, Check, Clock, Minus, Paperclip, X } from 'lucide-react';
import { ApiError, quotesApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';

export function QuoteThread({
  quote,
  viewerRole,
  onChanged,
  onAccepted,
}: {
  quote: any;
  viewerRole: 'CLIENT' | 'PROVIDER';
  onChanged: () => void;
  onAccepted?: (booking: any) => void;
}) {
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestPendingRevision = [...(quote.revisions ?? [])]
    .reverse()
    .find((r: any) => r.status === 'PENDING');

  const terms: [string, string][] = [
    ...(quote.estimatedDuration ? ([['Duration', quote.estimatedDuration]] as [string, string][]) : []),
    ...(quote.proposedDate ? ([['Proposed', new Date(quote.proposedDate).toLocaleDateString()]] as [string, string][]) : []),
    ...(quote.expiresAt ? ([['Expires', new Date(quote.expiresAt).toLocaleDateString()]] as [string, string][]) : []),
  ];

  async function run(action: () => Promise<any>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="surface-card overflow-hidden">
      {/* Headline: who is quoting, for how much, and where it stands. */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 p-5">
        <div className="min-w-0">
          <p className="eyebrow-muted">
            {viewerRole === 'CLIENT' ? quote.provider?.businessName : 'Your quote'}
          </p>
          <p className="mt-1.5 font-display text-3xl font-extrabold tabular tracking-tight text-ink-950">
            {Number(quote.price).toLocaleString()}
            <span className="ml-1.5 text-sm font-bold text-ink-400">{quote.currency}</span>
          </p>
        </div>
        <StatusBadge status={quote.status} />
      </header>

      <div className="p-5">
        {viewerRole === 'PROVIDER' && quote.status === 'PENDING' && (
          <div className="alert alert-info mb-4">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              Quote sent. The client can accept, decline, or propose a different price — you will
              be notified when they respond.
            </p>
          </div>
        )}

        {viewerRole === 'PROVIDER' && quote.status === 'ACCEPTED' && (
          <div className="alert alert-success mb-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              The client accepted this quote, so a booking has been created. Open your bookings to
              confirm it and arrange the date.
            </p>
          </div>
        )}

        {viewerRole === 'PROVIDER' && quote.status === 'REJECTED' && (
          <div className="alert alert-error mb-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>The client declined this quote. No further action is needed on it.</p>
          </div>
        )}

        {quote.description && <p className="prose-copy">{quote.description}</p>}

        {terms.length > 0 && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {terms.map(([label, value]) => (
              <div key={label} className="flex items-center gap-1.5">
                <dt className="text-xs font-medium text-ink-500">{label}</dt>
                <dd className="text-xs font-semibold text-ink-800">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {quote.materials && (
          <p className="mt-4 text-sm text-ink-600">
            <span className="font-semibold text-ink-800">Materials: </span>
            {quote.materials}
          </p>
        )}

        {/* Scope. Two columns of explicit yes/no is the whole point of a
            structured quote — it stops scope disputes at booking time. */}
        {(quote.includedItems?.length > 0 || quote.excludedItems?.length > 0) && (
          <div className="mt-5 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2">
            {quote.includedItems?.length > 0 && (
              <div>
                <p className="eyebrow-muted mb-2">Included</p>
                <ul className="space-y-1.5">
                  {quote.includedItems.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {quote.excludedItems?.length > 0 && (
              <div>
                <p className="eyebrow-muted mb-2">Not included</p>
                <ul className="space-y-1.5">
                  {quote.excludedItems.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ink-500">
                      <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {quote.attachments?.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
            {quote.attachments.map((a: any) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="chip-interactive max-w-full"
              >
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{a.fileName ?? 'Attachment'}</span>
              </a>
            ))}
          </div>
        )}

        {/* Negotiation history — newest first, so the live state is on top. */}
        {quote.revisions?.length > 0 && (
          <div className="mt-5 border-t border-ink-100 pt-4">
            <p className="eyebrow-muted mb-3">Negotiation history</p>
            <ol className="space-y-2.5">
              {[...quote.revisions].reverse().map((rev: any) => (
                <li
                  key={rev.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink-50/70 px-3 py-2.5"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-700">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    <span>
                      <span className="font-semibold text-ink-900">
                        {rev.proposedBy === viewerRole ? 'You' : 'They'}
                      </span>{' '}
                      proposed{' '}
                      <span className="font-bold tabular text-ink-950">
                        {Number(rev.price).toLocaleString()} {quote.currency}
                      </span>
                      {rev.message && <span className="text-ink-500"> — &ldquo;{rev.message}&rdquo;</span>}
                    </span>
                  </span>
                  <StatusBadge status={rev.status} />
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && (
          <div className="alert alert-error mt-4 py-3" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        {quote.status === 'PENDING' && (
          <div className="mt-5 space-y-4 border-t border-ink-200 pt-5">
            {/* A counter-offer awaiting our answer is time-sensitive, so it
                sits above everything else and is styled as a decision prompt. */}
            {latestPendingRevision && latestPendingRevision.proposedBy !== viewerRole && (
              <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
                <p className="text-sm font-semibold text-warning-800">
                  They countered at{' '}
                  <span className="tabular">
                    {Number(latestPendingRevision.price).toLocaleString()} {quote.currency}
                  </span>
                </p>
                {latestPendingRevision.message && (
                  <p className="mt-1 text-sm text-warning-700">&ldquo;{latestPendingRevision.message}&rdquo;</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => run(() => quotesApi.rejectRevision(latestPendingRevision.id))}
                    className="btn-secondary btn-sm flex-1"
                  >
                    Decline
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => run(() => quotesApi.acceptRevision(latestPendingRevision.id))}
                    className="btn-primary btn-sm flex-1"
                  >
                    Accept counter
                  </button>
                </div>
              </div>
            )}

            {/* Counter-offer composer */}
            <div>
              <p className="label">Propose a different price</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number"
                  min={0}
                  aria-label="Counter price in RWF"
                  placeholder="Price (RWF)"
                  className="tabular sm:w-40"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                />
                <input
                  aria-label="Message"
                  placeholder="Message (optional)"
                  className="min-w-0 flex-1"
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                />
                <button
                  disabled={busy || !counterPrice}
                  onClick={() =>
                    run(() =>
                      quotesApi.proposeRevision(quote.id, {
                        price: Number(counterPrice),
                        message: counterMessage || undefined,
                      }),
                    ).then(() => {
                      setCounterPrice('');
                      setCounterMessage('');
                    })
                  }
                  className="btn-secondary shrink-0"
                >
                  Propose
                </button>
              </div>
            </div>

            {/* Client-only: accept or reject outright. Accepting is the money
                moment, so it gets the filled treatment and the wider target. */}
            {viewerRole === 'CLIENT' && (
              <div className="space-y-3 border-t border-ink-100 pt-4">
                <p className="text-xs leading-relaxed text-ink-500">
                  Accepting creates a booking at this exact price and closes any other quotes on
                  your request. The provider then confirms and schedules the job. Payment is
                  handled directly with the provider — never through the platform.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    disabled={busy}
                    onClick={() => run(() => quotesApi.reject(quote.id))}
                    className="btn-secondary sm:flex-1"
                  >
                    <X className="h-4 w-4" aria-hidden="true" /> Reject
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const booking = await quotesApi.accept(quote.id);
                        onAccepted?.(booking);
                      })
                    }
                    className="btn-primary sm:flex-[1.4]"
                  >
                    Accept &amp; book
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
