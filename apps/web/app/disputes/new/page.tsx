'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { disputesApi, ApiError } from '@/lib/api';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

const CATEGORIES = [
  { value: 'SERVICE_NOT_AS_DESCRIBED', label: 'Service not as described' },
  { value: 'NO_SHOW', label: 'No-show' },
  { value: 'DAMAGE_OR_LOSS', label: 'Damage or loss' },
  { value: 'UNPROFESSIONAL_CONDUCT', label: 'Unprofessional conduct' },
  { value: 'PAYMENT_DISAGREEMENT', label: 'Payment disagreement' },
  { value: 'OTHER', label: 'Something else' },
];

function NewDisputeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId') ?? '';
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!bookingId) {
      setError('Missing booking reference');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Give a short summary of the problem');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dispute = await disputesApi.create({ bookingId, category, reason: reason.trim(), details: details.trim() || undefined });
      router.push(`/disputes/${dispute.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open this dispute');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Dispute"
        title="Report a problem"
        description="This opens a structured conversation with the other party, reviewed by our team if you can't resolve it together. We don't process payments for external transactions — this is for sorting out what happened."
      />

      {/* A dispute is always opened against a booking, so a link without one
          can't produce anything worth submitting. */}
      {!bookingId && (
        <div className="alert alert-info mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Open this from the booking page so we know which booking you&apos;re reporting a problem on.
        </div>
      )}

      <Panel>
        <div className="space-y-5">
          <div className="field">
            <label className="label" htmlFor="dispute-category">
              Category
            </label>
            <select
              id="dispute-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="hint">This is what routes it to the right reviewer — pick the closest fit.</p>
          </div>

          <div className="field">
            <label className="label" htmlFor="dispute-reason">
              What happened?
            </label>
            <input
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="Short summary"
            />
            <p className="hint">
              Up to 200 characters. The other party sees this first, so make it specific.
            </p>
          </div>

          <div className="field">
            <label className="label" htmlFor="dispute-details">
              Details <span className="font-normal text-ink-400">(optional)</span>
            </label>
            <textarea
              id="dispute-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Dates, amounts, what was agreed, what happened instead"
            />
            <p className="hint">You can attach photos or PDFs once the dispute is open.</p>
          </div>

          {error && (
            <p className="error-text" role="alert">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn-danger w-full"
          >
            {busy ? 'Submitting…' : 'Open dispute'}
          </button>
        </div>
      </Panel>
    </main>
  );
}

export default function NewDisputePage() {
  return (
    <Suspense
      fallback={
        <main className="page-narrow py-6 md:py-8">
          <LoadingBlock label="Opening the form…" />
        </main>
      }
    >
      <NewDisputeContent />
    </Suspense>
  );
}
