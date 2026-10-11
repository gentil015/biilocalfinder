'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Gavel, Paperclip, MessagesSquare, Scale } from 'lucide-react';
import { disputesApi, adminDisputesApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';

const RESOLUTION_TYPES = [
  { value: 'NO_ACTION', label: 'No action' },
  { value: 'WARNING_ISSUED', label: 'Warning issued' },
  { value: 'REFUND_RECOMMENDED', label: 'Refund recommended' },
  { value: 'PROVIDER_SUSPENDED', label: 'Provider suspended' },
  { value: 'BOOKING_CANCELLED', label: 'Booking cancelled' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABEL: Record<string, string> = {
  SERVICE_NOT_AS_DESCRIBED: 'Not as described',
  NO_SHOW: 'No-show',
  DAMAGE_OR_LOSS: 'Damage or loss',
  UNPROFESSIONAL_CONDUCT: 'Conduct',
  PAYMENT_DISAGREEMENT: 'Payment',
  OTHER: 'Other',
};

export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [dispute, setDispute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resolutionType, setResolutionType] = useState(RESOLUTION_TYPES[0].value);
  const [resolution, setResolution] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => disputesApi.getOne(id).then(setDispute).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, [id]);

  async function review() {
    setBusy(true);
    setError(null);
    try {
      await adminDisputesApi.review(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this dispute');
    } finally {
      setBusy(false);
    }
  }

  async function resolve(outcome: 'RESOLVED' | 'REJECTED') {
    setBusy(true);
    setError(null);
    try {
      await adminDisputesApi.resolve(id, { outcome, resolutionType, resolution: resolution.trim() || undefined });
      router.push('/admin/disputes');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resolve this dispute');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading the dispute…" />
      </main>
    );
  }
  if (!dispute) return null;

  const canReview = dispute.status === 'OPEN' || dispute.status === 'RESPONDED';
  const canResolve = dispute.status === 'UNDER_REVIEW';
  const closed = dispute.status === 'RESOLVED' || dispute.status === 'REJECTED';

  return (
    <main className="page-workspace py-6 md:py-8">
      <BackButton variant="link" label="Back to queue" fallbackHref="/admin/disputes" className="mb-3" />

      <PageHeader
        eyebrow={`Admin · ${CATEGORY_LABEL[dispute.category] ?? dispute.category.replace(/_/g, ' ').toLowerCase()}`}
        title={dispute.reason}
        description={`${dispute.raisedBy.firstName} ${dispute.raisedBy.lastName} vs ${dispute.respondent.firstName} ${dispute.respondent.lastName}`}
        actions={<StatusBadge status={dispute.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-4">
          <Panel title="The dispute">
            <dl className="detail-list">
              <div className="detail-row">
                <dt className="detail-key">Booking</dt>
                <dd className="detail-value">
                  <span className="tabular">#{dispute.booking.id.slice(0, 8)}</span>
                  <span className="ml-2 inline-block align-middle">
                    <StatusBadge status={dispute.booking.status} />
                  </span>
                </dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Raised by</dt>
                <dd className="detail-value">
                  {dispute.raisedBy.firstName} {dispute.raisedBy.lastName}
                </dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Against</dt>
                <dd className="detail-value">
                  {dispute.respondent.firstName} {dispute.respondent.lastName}
                </dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Opened</dt>
                <dd className="detail-value tabular">
                  {new Date(dispute.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            {dispute.details ? (
              <p className="mt-4 border-t border-ink-100 pt-4 text-sm leading-relaxed text-ink-700">
                {dispute.details}
              </p>
            ) : (
              <p className="hint mt-4 border-t border-ink-100 pt-4">
                The person who raised this didn&apos;t add any detail beyond the headline.
              </p>
            )}
          </Panel>

          <Panel
            title="Evidence"
            actions={
              <span className="badge badge-neutral">{dispute.evidence.length} attached</span>
            }
          >
            {dispute.evidence.length === 0 ? (
              <EmptyState
                icon={Paperclip}
                title="No evidence uploaded"
                body="Neither side attached a file. Resolve on the conversation alone."
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {dispute.evidence.map((e: any) => (
                  <a
                    key={e.id}
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="chip-interactive"
                  >
                    <Paperclip className="h-3 w-3" aria-hidden="true" /> {e.description || 'Evidence'}
                  </a>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Conversation"
            description="Both sides can still read this after you resolve."
            actions={
              <span className="badge badge-neutral">{dispute.messages.length} messages</span>
            }
          >
            {dispute.messages.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="No messages yet"
                body="The dispute was opened but nobody has responded in the thread yet."
              />
            ) : (
              <ul className="space-y-2.5">
                {dispute.messages.map((m: any) => (
                  <li key={m.id} className="surface-panel p-3.5">
                    <p className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-ink-700">
                        {m.author.firstName} {m.author.lastName}
                      </span>
                      <span className="text-2xs tabular text-ink-400">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </p>
                    <p className="text-sm leading-relaxed text-ink-700">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="lg:sticky lg:top-6">
          <Panel title={canResolve ? 'Resolution' : 'Next step'}>
            {error && (
              <p className="error-text mb-4" role="alert">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            {canReview && (
              <>
                <p className="prose-copy mb-4">
                  Reading the thread takes you out of the shared view with the other party. Move it to review
                  once you&apos;re ready to decide.
                </p>
                <button
                  type="button"
                  onClick={review}
                  disabled={busy}
                  className="btn-primary w-full"
                >
                  <Scale className="h-4 w-4" aria-hidden="true" />
                  {busy ? 'Updating…' : 'Move to review'}
                </button>
              </>
            )}

            {canResolve && (
              <>
                <p className="prose-copy mb-4">
                  A refund is only ever <em>recommended</em> here — the platform never moves money.
                </p>

                <div className="field mb-4">
                  <label className="label" htmlFor="resolution-type">
                    Resolution type
                  </label>
                  <select
                    id="resolution-type"
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value)}
                  >
                    {RESOLUTION_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field mb-5">
                  <label className="label" htmlFor="resolution-notes">
                    Notes for both parties
                  </label>
                  <textarea
                    id="resolution-notes"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={4}
                    placeholder="What you decided and why"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => resolve('RESOLVED')}
                    disabled={busy}
                    className="btn-primary w-full"
                  >
                    <Gavel className="h-4 w-4" aria-hidden="true" /> Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() => resolve('REJECTED')}
                    disabled={busy}
                    className="btn-secondary w-full"
                  >
                    Reject the dispute
                  </button>
                </div>
              </>
            )}

            {closed && (
              <p className="hint flex items-start gap-1.5">
                This dispute is closed ({dispute.status.replace(/_/g, ' ').toLowerCase()}). Both parties can
                still read the thread and the resolution notes.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </main>
  );
}
