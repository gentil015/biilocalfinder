'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Flag,
  History,
  MailCheck,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import { adminVerificationApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';

export default function AdminVerificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = () => adminVerificationApi.getOne(id).then(setRecord).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, [id]);

  async function act(action: 'approve' | 'reject' | 'suspend' | 'reinstate') {
    if ((action === 'reject' || action === 'suspend') && reason.trim().length < 5) {
      setError('Please give a reason (at least 5 characters)');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (action === 'approve') await adminVerificationApi.approve(id);
      else if (action === 'reinstate') await adminVerificationApi.reinstate(id);
      else await adminVerificationApi[action](id, reason.trim());
      router.push('/admin/verifications');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not complete that action');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading the submission…" />
      </main>
    );
  }
  if (!record) return null;

  const needsReason = record.status === 'PENDING' || record.status === 'VERIFIED';

  return (
    <main className="page-workspace py-6 md:py-8">
      <BackButton variant="link" label="Back to queue" fallbackHref="/admin/verifications" className="mb-3" />

      <PageHeader
        eyebrow={`Admin · ${record.type} verification`}
        title={record.provider.businessName}
        description={`${record.provider.user.firstName} ${record.provider.user.lastName} · ${record.provider.user.email}`}
        actions={<StatusBadge status={record.status} />}
      />

      {record.openReports > 0 && (
        <div className="alert alert-warning mb-4">
          <Flag className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">
              {record.openReports} open report{record.openReports === 1 ? '' : 's'}
            </span>{' '}
            on this provider. Read them before you trust a document.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="space-y-4">
          <Panel title="Submission">
            <dl className="detail-list">
              <div className="detail-row">
                <dt className="detail-key">Type</dt>
                <dd className="detail-value">{record.type.replace(/_/g, ' ').toLowerCase()}</dd>
              </div>
              {record.legalName && (
                <div className="detail-row">
                  <dt className="detail-key">Legal name</dt>
                  <dd className="detail-value">{record.legalName}</dd>
                </div>
              )}
              {record.referenceNumber && (
                <div className="detail-row">
                  <dt className="detail-key">Reference number</dt>
                  <dd className="detail-value tabular">{record.referenceNumber}</dd>
                </div>
              )}
              <div className="detail-row">
                <dt className="detail-key">Submitted</dt>
                <dd className="detail-value tabular">{new Date(record.submittedAt).toLocaleDateString()}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Contact verified</dt>
                <dd className="detail-value">
                  <span className="flex items-center justify-end gap-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        record.provider.user.emailVerified ? 'text-success-700' : 'text-warning-700'
                      }`}
                    >
                      <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {record.provider.user.emailVerified ? 'Email' : 'Email unverified'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs ${
                        record.provider.user.phoneVerified ? 'text-success-700' : 'text-warning-700'
                      }`}
                    >
                      <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
                      {record.provider.user.phoneVerified ? 'Phone' : 'Phone unverified'}
                    </span>
                  </span>
                </dd>
              </div>
            </dl>

            {record.submitterNote && (
              <div className="surface-panel mt-4 p-4">
                <p className="eyebrow-muted mb-1.5">Note from the provider</p>
                <p className="text-sm leading-relaxed text-ink-700">{record.submitterNote}</p>
              </div>
            )}
          </Panel>

          <Panel
            title="Documents"
            description={`Signed links expire in ${Math.round(record.documentLinksExpireInSeconds / 60)} minutes — they were issued when you opened this record.`}
            actions={
              <span className="badge badge-neutral">{record.documents.length} uploaded</span>
            }
          >
            {record.documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents attached"
                body="This submission can't be approved on evidence — reject it and ask for the documents."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {record.documents.map((d: any) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="surface-card-interactive flex items-center gap-3 p-3.5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink-950">
                        {d.documentType.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <span className="block text-xs tabular text-ink-500">
                        {(d.sizeBytes / 1024).toFixed(0)} KB
                      </span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </Panel>

          {record.history?.length > 0 && (
            <Panel title="History" description="Recent decisions for this provider.">
              <ul className="detail-list">
                {record.history.map((h: any) => (
                  <li key={h.id} className="detail-row items-start">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{h.type}</span>
                        <StatusBadge status={h.status} />
                      </p>
                      {h.decisionNote && (
                        <p className="mt-1 text-xs leading-relaxed text-ink-500">{h.decisionNote}</p>
                      )}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs tabular text-ink-500">
                      {new Date(h.submittedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          <Panel title="Decision">
            {record.status === 'PENDING' && (
              <p className="prose-copy mb-4">
                Approving publishes a trust badge on the provider&apos;s listings. Rejecting is terminal
                until they submit again.
              </p>
            )}
            {record.status === 'VERIFIED' && (
              <p className="prose-copy mb-4">
                Suspending withdraws the trust badge immediately and hides the provider from search until
                it&apos;s reinstated.
              </p>
            )}
            {record.status === 'SUSPENDED' && (
              <p className="prose-copy mb-4">Reinstate to restore the trust badge and its benefits.</p>
            )}

            {needsReason && (
              <div className="field mb-4">
                <label className="label" htmlFor="decision-reason">
                  Reason
                </label>
                <textarea
                  id="decision-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    record.status === 'PENDING' ? 'Required to reject' : 'Required to suspend'
                  }
                  rows={3}
                />
                <p className="hint">Recorded on the audit trail and shown to the provider.</p>
              </div>
            )}

            {error && (
              <p className="error-text mb-4" role="alert">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {record.status === 'PENDING' && (
                <>
                  <button type="button" onClick={() => act('approve')} disabled={busy} className="btn-primary flex-1">
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => act('reject')}
                    disabled={busy}
                    className="btn-secondary flex-1"
                  >
                    Reject
                  </button>
                </>
              )}
              {record.status === 'VERIFIED' && (
                <button
                  type="button"
                  onClick={() => act('suspend')}
                  disabled={busy}
                  className="btn-danger w-full"
                >
                  Suspend verification
                </button>
              )}
              {record.status === 'SUSPENDED' && (
                <button
                  type="button"
                  onClick={() => act('reinstate')}
                  disabled={busy}
                  className="btn-primary w-full"
                >
                  Reinstate
                </button>
              )}
              {(record.status === 'REJECTED' || record.status === 'EXPIRED') && (
                <p className="hint flex items-start gap-1.5">
                  <History className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Nothing left to decide — this record is closed. The provider has to submit a fresh one.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}
