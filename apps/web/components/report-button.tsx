'use client';

import { useId, useState } from 'react';
import { Flag, ShieldCheck, X } from 'lucide-react';
import { reportsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

const CATEGORY_LABELS: Record<string, string> = {
  FRAUD_OR_SCAM: 'Fraud or scam',
  FAKE_LISTING: 'Fake listing',
  IMPERSONATION: 'Impersonation',
  MISLEADING_PRICE: 'Misleading price',
  INAPPROPRIATE_CONTENT: 'Inappropriate content',
  HARASSMENT: 'Harassment',
  FAKE_REVIEW: 'Fake review',
  OTHER: 'Something else',
};

export function ReportButton({
  targetType,
  targetId,
  label = 'Report',
  className = 'btn btn-sm w-full justify-start text-ink-400 hover:bg-danger-50 hover:text-danger-700',
}: {
  targetType: 'USER' | 'PROVIDER' | 'MESSAGE' | 'BOOKING' | 'REVIEW' | 'SERVICE_OFFERING';
  targetId: string;
  label?: string;
  className?: string;
}) {
  // Session state from context rather than isLoggedIn(): the latter reads
  // localStorage, which differs between the server render and the client's
  // first render and so caused a hydration mismatch on this button.
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('OTHER');
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const titleId = useId();
  const categoryFieldId = useId();
  const reasonId = useId();
  const detailsId = useId();

  if (loading || !user) return null;

  async function submit() {
    if (reason.trim().length < 3) {
      setError('Tell us a little more about the issue');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reportsApi.create({ targetType, targetId, category, reason: reason.trim(), details: details.trim() || undefined });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-home-night/50 backdrop-blur-sm md:items-center md:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl md:rounded-2xl md:p-6"
          >
            {done ? (
              <div className="flex flex-col items-center py-6 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-semibold text-ink-900">Thanks — our team will take a look.</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    setDone(false);
                    setReason('');
                    setDetails('');
                  }}
                  className="btn-primary mt-6 w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow-muted">Trust &amp; safety</p>
                    <h3 id={titleId} className="card-title mt-1">
                      Report this {targetType.toLowerCase().replace('_', ' ')}
                    </h3>
                  </div>
                  <button onClick={() => setOpen(false)} aria-label="Close" className="icon-btn -mr-1.5 -mt-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="field">
                    <label htmlFor={categoryFieldId} className="label">
                      Category
                    </label>
                    <select id={categoryFieldId} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {Object.entries(CATEGORY_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor={reasonId} className="label">
                      What happened?
                    </label>
                    <input
                      id={reasonId}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={200}
                      placeholder="Short summary"
                    />
                    <p className="hint">
                      A few words are enough — at least 3 characters. <span className="tabular">{reason.length}/200</span>
                    </p>
                  </div>

                  <div className="field">
                    <label htmlFor={detailsId} className="label">
                      Details <span className="font-normal text-ink-400">(optional)</span>
                    </label>
                    <textarea
                      id={detailsId}
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      placeholder="Anything else our team should know"
                    />
                    <p className="hint tabular">{details.length}/2000 characters</p>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-error mt-4" role="alert">
                    <span>{error}</span>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button onClick={() => setOpen(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button onClick={submit} disabled={submitting} aria-busy={submitting} className="btn-danger flex-1">
                    {submitting ? 'Sending…' : 'Submit report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
