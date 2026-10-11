'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Globe, IdCard, ShieldCheck, XCircle } from 'lucide-react';
import { adminProviderApplicationsApi, ApiError } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';
import { BackButton } from '@/components/back-button';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-ink-100 py-2.5 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-900">{value ?? '—'}</dd>
    </div>
  );
}

export default function AdminProviderApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminProviderApplicationsApi
      .getOne(id)
      .then(setApplication)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this application'))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function decide(action: 'approve' | 'reject') {
    if (action === 'reject' && reason.trim().length < 3) {
      setError('Give the applicant a reason — they are shown this.');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      if (action === 'approve') {
        await adminProviderApplicationsApi.approve(id, note.trim() || undefined);
      } else {
        await adminProviderApplicationsApi.reject(id, reason.trim());
      }
      router.push('/admin/provider-applications');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That decision could not be saved');
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <LoadingBlock label="Loading application…" />
      </main>
    );
  }

  if (!application) {
    return (
      <main className="page-workspace py-6 md:py-8">
        <PageHeader eyebrow="Admin" title="Application not found" />
        <p className="text-sm text-ink-500">{error ?? 'It may have been deleted.'}</p>
        <Link href="/admin/provider-applications" className="btn-secondary btn-sm mt-4">
          Back to applications
        </Link>
      </main>
    );
  }

  const decided = application.status !== 'PENDING';
  const user = application.user ?? {};

  return (
    <main className="page-workspace py-6 md:py-8">
      <BackButton variant="icon" label="Back to applications" fallbackHref="/admin/provider-applications" className="mb-4" />

      <PageHeader
        eyebrow="Admin · Provider application"
        title={application.businessName}
        description="Approving turns this applicant's existing client account into a provider account."
        actions={<StatusBadge status={application.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          <Panel title="Applicant">
            <dl>
              <Row label="Name" value={`${user.firstName ?? ''} ${user.lastName ?? ''}`} />
              <Row label="Email" value={user.email} />
              <Row label="Phone on account" value={user.phone} />
              <Row label="Email verified" value={user.emailVerified ? 'Yes' : 'No'} />
              <Row label="Phone verified" value={user.phoneVerified ? 'Yes' : 'No'} />
              <Row label="Account created" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : null} />
            </dl>
          </Panel>

          <Panel title="What they applied with">
            <dl>
              <Row label="Business name" value={application.businessName} />
              <Row label="Provider type" value={<span className="uppercase">{application.providerType}</span>} />
              <Row label="Phone" value={application.phone} />
              <Row label="Years of experience" value={application.yearsOfExperience} />
              <Row label="Registration number" value={application.registrationNumber} />
              <Row label="ID number" value={application.idNumber} />
              <Row
                label="Website"
                value={
                  application.websiteUrl ? (
                    <a
                      href={application.websiteUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 underline"
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                      {application.websiteUrl.replace(/^https?:\/\//, '')}
                    </a>
                  ) : null
                }
              />
            </dl>

            {application.description && (
              <div className="mt-4 border-t border-ink-100 pt-4">
                <p className="label">Description</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                  {application.description}
                </p>
              </div>
            )}
          </Panel>

          {application.categories?.length > 0 && (
            <Panel title={`Services offered (${application.categories.length})`}>
              <div className="flex flex-wrap gap-2">
                {application.categories.map((c: string) => (
                  <span key={c} className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">
                    {c.replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {!decided && (
            <Panel title="Decision">
              <div className="space-y-4">
                <div className="field">
                  <label htmlFor="note" className="label">
                    Note for the approval <span className="font-normal text-ink-400">(optional)</span>
                  </label>
                  <textarea
                    id="note"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                    placeholder="e.g. ID and registration checked against the register."
                  />
                </div>

                <div className="field">
                  <label htmlFor="reason" className="label">
                    Reason for rejection <span className="font-normal text-ink-400">(required to reject)</span>
                  </label>
                  <textarea
                    id="reason"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    placeholder="e.g. The ID number does not match the account name."
                  />
                  <p className="hint">Shown to the applicant, so keep it something they can act on.</p>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => decide('approve')}
                    disabled={busy !== null}
                    className="btn-primary"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {busy === 'approve' ? 'Approving…' : 'Approve application'}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide('reject')}
                    disabled={busy !== null}
                    className="btn-secondary"
                  >
                    <XCircle className="h-4 w-4" aria-hidden="true" />
                    {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          <Panel title="What approval does">
            <ul className="space-y-2.5 text-sm text-ink-600">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  Flips <code className="text-xs">role</code> to <strong>PROVIDER</strong> on{' '}
                  <code className="text-xs">{user.email}</code> — no new login is created.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>Creates their workspace and provider profile, with the applied details filled in.</span>
              </li>
              <li className="flex gap-2.5">
                <IdCard className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  Leaves their client history intact — requests, bookings and messages stay theirs.
                </span>
              </li>
            </ul>
          </Panel>

          {decided && (
            <Panel title="Decision on record">
              <dl>
                <Row label="Status" value={<StatusBadge status={application.status} />} />
                <Row label="Reviewed" value={application.reviewedAt ? new Date(application.reviewedAt).toLocaleString() : null} />
                <Row
                  label="Reviewer"
                  value={
                    application.reviewedBy
                      ? `${application.reviewedBy.firstName} ${application.reviewedBy.lastName}`
                      : null
                  }
                />
                <Row label="Note" value={application.decisionNote} />
              </dl>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}