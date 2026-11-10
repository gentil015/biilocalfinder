'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { PageHeader, Panel, Skeleton, StatCard } from '@/components/ui/page';
import {
  trustSafetyAdminApi,
  type TrustFlaggedAccount,
  type TrustOverview,
} from '@/lib/api';

export default function TrustSafetyPage() {
  const [overview, setOverview] = useState<TrustOverview | null>(null);
  const [accounts, setAccounts] = useState<TrustFlaggedAccount[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const relatedBookings = selected
    ? [
        ...(selected.clientProfile?.bookings ?? []),
        ...selected.providers.flatMap((provider: any) => provider.bookings ?? []),
      ]
    : [];
  const relatedReviews = selected
    ? selected.providers.flatMap((provider: any) => provider.reviews ?? [])
    : [];

  const load = useCallback(async () => {
    setError(null);
    try {
      const [stats, flagged, openReports] = await Promise.all([
        trustSafetyAdminApi.overview(),
        trustSafetyAdminApi.flaggedAccounts(),
        trustSafetyAdminApi.reports(),
      ]);
      setOverview(stats);
      setAccounts(flagged.items);
      setReports(openReports.items.filter((report) =>
        ['PENDING', 'UNDER_INVESTIGATION', 'ADDITIONAL_INFORMATION_REQUIRED', 'ESCALATED'].includes(report.status),
      ));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load trust and safety data');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openAccount(account: TrustFlaggedAccount) {
    setError(null);
    try {
      setSelected(await trustSafetyAdminApi.account(account.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the account investigation');
    }
  }

  async function reassess(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.reassess(userId);
      await load();
      const account = accounts.find((item) => item.id === userId);
      if (account) await openAccount(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reassess this account');
    } finally {
      setBusy(false);
    }
  }

  async function runProviderScreening(userId: string) {
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.screenProvider(userId);
      await load();
      setSelected(await trustSafetyAdminApi.account(userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not run provider fraud screening');
    } finally {
      setBusy(false);
    }
  }

  async function reviewAssessment(id: string, status: 'REVIEWED' | 'DISMISSED' | 'CONFIRMED') {
    const note = window.prompt('Add an investigation note (required):');
    if (!note?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.reviewAssessment(id, status, note.trim());
      await load();
      if (selected) setSelected(await trustSafetyAdminApi.account(selected.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the investigation decision');
    } finally {
      setBusy(false);
    }
  }

  async function updateReport(id: string, status: 'UNDER_INVESTIGATION' | 'RESOLVED' | 'DISMISSED') {
    const resolution = status === 'RESOLVED' || status === 'DISMISSED'
      ? window.prompt('Add a resolution note (required):')
      : undefined;
    if ((status === 'RESOLVED' || status === 'DISMISSED') && !resolution?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.updateReport(id, status, resolution?.trim());
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the report');
    } finally {
      setBusy(false);
    }
  }

  async function restrictBookings(userId: string) {
    const reason = window.prompt('Reason for restricting booking activity:');
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.createRestriction(userId, 'BOOKING_RESTRICTED', reason.trim());
      await load();
      setSelected(await trustSafetyAdminApi.account(userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not restrict booking activity');
    } finally {
      setBusy(false);
    }
  }

  async function liftRestriction(restrictionId: string, userId: string) {
    const reason = window.prompt('Reason for restoring this account:');
    if (!reason?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await trustSafetyAdminApi.liftRestriction(restrictionId, reason.trim());
      await load();
      setSelected(await trustSafetyAdminApi.account(userId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not lift the restriction');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Trust & safety"
        title="Investigation console"
        description="Review explainable risk signals and user reports. Automated signals are not proof of fraud and do not impose restrictions."
        actions={
          <button type="button" className="btn-secondary btn-sm" onClick={() => void load()} disabled={busy}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {error && <div className="alert alert-error mb-6" role="alert">{error}</div>}

      {overview ? (
        <section aria-label="Trust and safety overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={Users} label="Monitored accounts" value={String(overview.totalUsers)} />
          <StatCard icon={ShieldAlert} label="Provider applications" value={String(overview.pendingProviderApplications)} />
          <StatCard icon={ShieldAlert} label="Pending verifications" value={String(overview.pendingProviderVerifications)} />
          <StatCard icon={AlertTriangle} label="Flagged accounts" value={String(overview.flaggedAccounts)} tone={overview.flaggedAccounts ? 'warning' : 'neutral'} />
          <StatCard icon={AlertTriangle} label="High-risk reviews" value={String(overview.highRiskInvestigations)} tone={overview.highRiskInvestigations ? 'warning' : 'neutral'} />
          <StatCard icon={AlertTriangle} label="Open reports" value={String(overview.openReports)} tone={overview.openReports ? 'warning' : 'neutral'} />
          <StatCard icon={ShieldAlert} label="Confirmed cases" value={String(overview.confirmedCases)} />
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </section>
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Flagged accounts">
          {accounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="border-b border-ink-200 text-xs uppercase text-ink-500">
                  <tr><th className="py-2 pr-3">Account</th><th className="py-2 pr-3">Risk</th><th className="py-2 pr-3">Main reasons</th><th className="py-2">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {accounts.map((account) => {
                    const assessment = account.riskAssessments[0];
                    return (
                      <tr key={account.id} className="align-top">
                        <td className="py-3 pr-3">
                          <div className="font-semibold">{account.firstName} {account.lastName}</div>
                          <div className="text-xs text-ink-500">{account.role} · joined {new Date(account.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="font-bold">{assessment?.riskScore ?? 0}/100</span>
                          <div className="text-xs text-ink-500">{assessment?.riskLevel ?? 'LOW'}</div>
                        </td>
                        <td className="max-w-xs py-3 pr-3 text-ink-600">
                          {assessment?.indicators.map((indicator) => indicator.reason).join(' ') || 'No indicator details'}
                        </td>
                        <td className="py-3">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => void openAccount(account)}>Investigate</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="py-6 text-sm text-ink-500">No accounts are currently flagged for review.</p>}
        </Panel>

        <Panel title="Recent security events">
          <ul className="divide-y divide-ink-100">
            {(overview?.recentEvents ?? []).map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <span>
                  <span className="block font-semibold">{event.eventType.replaceAll('_', ' ')}</span>
                  <span className="text-xs text-ink-500">{event.userId ? `Account ${event.userId}` : 'Unlinked event'}</span>
                </span>
                <time className="shrink-0 text-xs text-ink-500">{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
            {!overview?.recentEvents.length && <li className="py-5 text-sm text-ink-500">No events recorded yet.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="Open fraud reports" className="mt-5">
        {reports.length ? (
          <ul className="divide-y divide-ink-100">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold">{report.category.replaceAll('_', ' ')} · {report.status.replaceAll('_', ' ')}</div>
                  <p className="mt-1 max-w-3xl text-sm text-ink-600">{report.description}</p>
                  <p className="mt-1 text-xs text-ink-500">
                    Reported account: {report.reportedUser.firstName} {report.reportedUser.lastName} · {new Date(report.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void updateReport(report.id, 'UNDER_INVESTIGATION')}>Investigate</button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void updateReport(report.id, 'RESOLVED')}>Resolve</button>
                  <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void updateReport(report.id, 'DISMISSED')}>Dismiss</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="py-5 text-sm text-ink-500">No open fraud reports.</p>}
      </Panel>

      {selected && (
        <Panel title={`Investigation · ${selected.firstName} ${selected.lastName}`} className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-ink-600">{selected.role} · {selected.status}</p>
              <p className="text-sm text-ink-600">Email verified: {selected.emailVerified ? 'Yes' : 'No'} · Phone verified: {selected.phoneVerified ? 'Yes' : 'No'}</p>
              <p className="text-sm text-ink-600">Account ID: {selected.id}</p>
              <button type="button" className="btn-secondary btn-sm mt-3" disabled={busy} onClick={() => void reassess(selected.id)}>Reassess signals</button>
              <button type="button" className="btn-secondary btn-sm ml-2 mt-3" disabled={busy} onClick={() => void runProviderScreening(selected.id)}>Run fraud screening</button>
              <button type="button" className="btn-secondary btn-sm ml-2 mt-3" disabled={busy} onClick={() => void restrictBookings(selected.id)}>Restrict booking activity</button>
            </div>
            <div>
              <h3 className="font-semibold">Provider verification checks</h3>
              {selected.providers.flatMap((provider: any) => provider.verificationChecks).length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {selected.providers.flatMap((provider: any) => provider.verificationChecks).map((check: any) => (
                    <li key={check.id}>
                      <span>{check.checkType.replaceAll('_', ' ')} · {check.status}</span>
                      {check.details && <span className="mt-1 block text-xs text-ink-500">{check.details}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-ink-500">No provider checks recorded.</p>}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <h3 className="font-semibold">Assessment history</h3>
            {selected.riskAssessments.map((assessment: any) => (
              <div key={assessment.id} className="rounded-xl border border-ink-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong>{assessment.riskScore}/100 · {assessment.riskLevel} · {assessment.assessmentStatus}</strong>
                  <span className="text-xs text-ink-500">{new Date(assessment.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm text-ink-600">{assessment.summary}</p>
                {assessment.indicators.map((indicator: any) => (
                  <p key={indicator.id} className="mt-1 text-xs text-ink-500">+{indicator.points} · {indicator.reason}</p>
                ))}
                {assessment.assessmentStatus === 'PENDING' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void reviewAssessment(assessment.id, 'REVIEWED')}>Mark reviewed</button>
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void reviewAssessment(assessment.id, 'DISMISSED')}>Dismiss signals</button>
                    <button className="btn-secondary btn-sm" disabled={busy} onClick={() => void reviewAssessment(assessment.id, 'CONFIRMED')}>Confirm finding</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-5">
            <h3 className="font-semibold">Recent booking and review history</h3>
            {relatedBookings.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {relatedBookings.map((booking: any) => (
                  <li key={booking.id} className="rounded-lg bg-ink-50 p-3">
                    Booking {booking.id} · {booking.status} · {new Date(booking.createdAt).toLocaleDateString()}
                    {booking.provider?.businessName ? ` · ${booking.provider.businessName}` : ''}
                    {booking.review ? ` · review ${booking.review.rating}/5` : ''}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-500">No recent bookings.</p>}
            {relatedReviews.length > 0 && (
              <ul className="mt-2 space-y-2 text-sm">
                {relatedReviews.map((review: any) => (
                  <li key={review.id} className="rounded-lg bg-ink-50 p-3">
                    Provider review · {review.rating}/5 · {new Date(review.createdAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-5">
            <h3 className="font-semibold">Fraud reports against this account</h3>
            {selected.fraudReportsAgainst.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {selected.fraudReportsAgainst.map((report: any) => (
                  <li key={report.id} className="rounded-lg bg-ink-50 p-3">
                    {report.category.replaceAll('_', ' ')} · {report.status.replaceAll('_', ' ')} · {new Date(report.createdAt).toLocaleDateString()}
                    {report.resolution ? ` · ${report.resolution}` : ''}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-500">No reports against this account.</p>}
          </div>
          <div className="mt-5">
            <h3 className="font-semibold">Previous restrictions</h3>
            {selected.accountRestrictions.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {selected.accountRestrictions.map((restriction: any) => (
                  <li key={restriction.id} className="rounded-lg bg-ink-50 p-3">
                    <span>{restriction.restrictionType.replaceAll('_', ' ')} · {restriction.status} · {restriction.reason}</span>
                    {restriction.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="btn-secondary btn-sm ml-3"
                        disabled={busy}
                        onClick={() => void liftRestriction(restriction.id, selected.id)}
                      >
                        Lift restriction
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-ink-500">No restrictions recorded.</p>}
          </div>
        </Panel>
      )}
    </main>
  );
}
