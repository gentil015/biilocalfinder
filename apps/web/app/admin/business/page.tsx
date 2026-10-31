'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Flag,
  Handshake,
  Percent,
  Scale,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  UserX,
} from 'lucide-react';
import { adminApi, type AdminBusinessAnalytics } from '@/lib/api';
import { LoadingBlock, PageHeader, Panel, StatCard } from '@/components/ui/page';

const PERIODS = [7, 30, 90];

function formatNumber(value: number) {
  return value.toLocaleString();
}

function ChangeBadge({
  value,
  goodWhen = 'up',
  label = 'vs previous period',
}: {
  value: number | null;
  goodWhen?: 'up' | 'down';
  label?: string;
}) {
  if (value === null) {
    return <span className="text-xs text-ink-400">No previous data</span>;
  }

  const flat = value === 0;
  const up = value > 0;
  const good = flat ? null : goodWhen === 'up' ? up : !up;
  const tone = good === null ? 'text-ink-500' : good ? 'text-success-700' : 'text-danger-700';
  const Icon = up ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      {!flat && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {flat ? 'No change' : `${up ? '+' : ''}${value}%`}
      <span className="font-normal text-ink-400">{label}</span>
    </span>
  );
}

function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="card-title">
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink-500">{description}</p>
    </div>
  );
}

function Insight({
  tone,
  title,
  body,
}: {
  tone: 'success' | 'warning' | 'info';
  title: string;
  body: string;
}) {
  const styles = {
    success: { icon: CheckCircle2, wrap: 'bg-success-50 text-success-700' },
    warning: { icon: AlertTriangle, wrap: 'bg-warning-50 text-warning-700' },
    info: { icon: Activity, wrap: 'bg-brand-50 text-brand-700' },
  }[tone];
  const Icon = styles.icon;

  return (
    <li className="flex gap-3 rounded-xl border border-ink-200 p-3.5">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${styles.wrap}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink-900">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-ink-600">{body}</span>
      </span>
    </li>
  );
}

export default function AdminBusinessPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AdminBusinessAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .business(days)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load business performance');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const complaintsPerHundredConnections =
    data && data.bookings.successfulConnections > 0
      ? Math.round((data.complaints.inPeriod / data.bookings.successfulConnections) * 1000) / 10
      : 0;

  const insights: { tone: 'success' | 'warning' | 'info'; title: string; body: string }[] = [];
  if (data) {
    if (data.providers.registered === 0) {
      insights.push({
        tone: 'info',
        title: 'No providers registered yet',
        body: 'Supply-side metrics will fill in as providers complete sign-up and publish a profile.',
      });
    } else if (data.providers.activeRate < 50) {
      insights.push({
        tone: 'warning',
        title: 'Less than half of registered providers are active',
        body: `${data.providers.active} of ${data.providers.registered} provider accounts are in good standing. Review suspended accounts and providers who never completed onboarding.`,
      });
    }

    if (data.complaints.open > 0) {
      insights.push({
        tone: 'warning',
        title: `${data.complaints.open} complaint${data.complaints.open === 1 ? '' : 's'} still open`,
        body: `${data.complaints.openReports} report${data.complaints.openReports === 1 ? '' : 's'} and ${data.complaints.openDisputes} dispute${data.complaints.openDisputes === 1 ? '' : 's'} need an admin decision.`,
      });
    }

    if (data.users.churnRate >= 20 && data.users.activeInPreviousPeriod > 0) {
      insights.push({
        tone: 'warning',
        title: 'Retention needs attention',
        body: `${data.users.churned} previously active users did not return during this period (${data.users.churnRate}% churn).`,
      });
    }

    if (data.bookings.requestsInPeriod > 0 && data.bookings.successfulConnections === 0) {
      insights.push({
        tone: 'warning',
        title: 'Requests are coming in but no jobs are completing',
        body: 'Look at provider response times, quote acceptance and booking hand-offs before spending more on demand generation.',
      });
    }

    if (insights.length === 0) {
      insights.push({
        tone: 'success',
        title: 'No urgent business signals',
        body: 'Provider supply, connections, complaints and retention are all within a healthy range for this period.',
      });
    }
  }

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Business"
        title="Business performance"
        description="Understand the health of the marketplace: provider supply, booking demand, completed connections, complaints and users who stopped coming back."
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reporting period">
            {PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                aria-pressed={days === option}
                className={`chip-interactive ${days === option ? 'chip-active' : ''}`}
              >
                {option} days
              </button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="alert alert-error mb-6" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && <LoadingBlock label="Loading business performance…" />}

      {!loading && data && (
        <>
          <section aria-labelledby="providers-heading" className="mb-6">
            <SectionHeading
              id="providers-heading"
              title="Provider health"
              description="Registered supply and how much of it is active and available to clients."
            />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="Registered providers"
                value={formatNumber(data.providers.registered)}
                sub={`${formatNumber(data.providers.newInPeriod)} new in ${data.periodLabel.toLowerCase()}`}
              />
              <StatCard
                icon={UserCheck}
                label="Active providers"
                value={formatNumber(data.providers.active)}
                sub={`${data.providers.activeRate}% of registered`}
                tone={data.providers.activeRate >= 50 ? 'success' : 'warning'}
              />
              <StatCard
                icon={Activity}
                label="Available now"
                value={formatNumber(data.providers.availableNow)}
                sub="Ready to accept work"
              />
              <StatCard
                icon={TrendingUp}
                label="New providers"
                value={formatNumber(data.providers.newInPeriod)}
                sub={`${formatNumber(data.providers.newInPreviousPeriod)} in previous period`}
              />
            </div>
          </section>

          <section aria-labelledby="bookings-heading" className="mb-6">
            <SectionHeading
              id="bookings-heading"
              title="Demand and connections"
              description="Booking requests raised by clients and the jobs that actually completed."
            />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={ClipboardList}
                label="Booking requests"
                value={formatNumber(data.bookings.requestsInPeriod)}
                sub={`${formatNumber(data.bookings.totalRequests)} all time`}
              />
              <StatCard
                icon={Handshake}
                label="Successful connections"
                value={formatNumber(data.bookings.successfulConnections)}
                sub="Completed jobs this period"
                tone={data.bookings.successfulConnections > 0 ? 'success' : 'neutral'}
              />
              <StatCard
                icon={CalendarCheck}
                label="Bookings created"
                value={formatNumber(data.bookings.bookingsInPeriod)}
                sub={`${formatNumber(data.bookings.cancelledInPeriod)} cancelled`}
              />
              <StatCard
                icon={Percent}
                label="Connection rate"
                value={`${data.bookings.connectionRate}%`}
                sub="Completed vs requests this period"
              />
            </div>
          </section>

          <section aria-labelledby="complaints-heading" className="mb-6">
            <SectionHeading
              id="complaints-heading"
              title="Complaints"
              description="Reports and disputes raised by clients or providers."
            />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={AlertTriangle}
                label="Open complaints"
                value={formatNumber(data.complaints.open)}
                sub={`${data.complaints.openReports} reports · ${data.complaints.openDisputes} disputes`}
                tone={data.complaints.open > 0 ? 'warning' : 'success'}
              />
              <StatCard
                icon={Flag}
                label="New complaints"
                value={formatNumber(data.complaints.inPeriod)}
                sub={`${data.complaints.reportsInPeriod} reports · ${data.complaints.disputesInPeriod} disputes`}
              />
              <StatCard
                icon={Scale}
                label="Per 100 connections"
                value={data.bookings.successfulConnections > 0 ? complaintsPerHundredConnections.toFixed(1) : '—'}
                sub="New complaints this period"
              />
              <StatCard
                icon={Flag}
                label="Total complaints"
                value={formatNumber(data.complaints.total)}
                sub={`${formatNumber(data.complaints.reportsTotal)} reports · ${formatNumber(data.complaints.disputesTotal)} disputes`}
              />
            </div>
          </section>

          <section aria-labelledby="users-heading" className="mb-6">
            <SectionHeading
              id="users-heading"
              title="Users and retention"
              description="Who is still using the platform, who went quiet, and who left for good."
            />
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={Users}
                label="Active users"
                value={formatNumber(data.users.activeInPeriod)}
                sub={`${formatNumber(data.users.newInPeriod)} new this period`}
                tone={data.users.activeInPeriod > 0 ? 'success' : 'neutral'}
              />
              <StatCard
                icon={UserX}
                label="Stopped using"
                value={formatNumber(data.users.churned)}
                sub={`${data.users.churnRate}% of previously active`}
                tone={data.users.churned > 0 ? 'warning' : 'success'}
              />
              <StatCard
                icon={UserMinus}
                label="Inactive users"
                value={formatNumber(data.users.inactive)}
                sub={`No sign-in in the last ${data.periodDays} days`}
                tone={data.users.inactive > 0 ? 'warning' : 'neutral'}
              />
              <StatCard
                icon={UserMinus}
                label="Deactivated accounts"
                value={formatNumber(data.users.deactivated)}
                sub={`${formatNumber(data.users.suspended)} suspended`}
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Panel title="Period comparison" description={`${data.periodLabel} against the previous ${data.periodDays} days.`}>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Metric</th>
                      <th scope="col" className="text-right">This period</th>
                      <th scope="col" className="text-right">Previous</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>New providers</td>
                      <td className="text-right tabular">{formatNumber(data.providers.newInPeriod)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.providers.newInPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.providers.newChange} /></td>
                    </tr>
                    <tr>
                      <td>Booking requests</td>
                      <td className="text-right tabular">{formatNumber(data.bookings.requestsInPeriod)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.bookings.requestsInPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.bookings.requestsChange} /></td>
                    </tr>
                    <tr>
                      <td>Successful connections</td>
                      <td className="text-right tabular">{formatNumber(data.bookings.successfulConnections)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.bookings.successfulConnectionsInPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.bookings.connectionsChange} /></td>
                    </tr>
                    <tr>
                      <td>New complaints</td>
                      <td className="text-right tabular">{formatNumber(data.complaints.inPeriod)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.complaints.inPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.complaints.change} goodWhen="down" /></td>
                    </tr>
                    <tr>
                      <td>New users</td>
                      <td className="text-right tabular">{formatNumber(data.users.newInPeriod)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.users.newInPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.users.newChange} /></td>
                    </tr>
                    <tr>
                      <td>Active users</td>
                      <td className="text-right tabular">{formatNumber(data.users.activeInPeriod)}</td>
                      <td className="text-right tabular text-ink-500">{formatNumber(data.users.activeInPreviousPeriod)}</td>
                      <td><ChangeBadge value={data.users.activeChange} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                Activity is measured from sign-in and session-refresh events. Admin accounts are excluded from user and retention metrics.
              </p>
            </Panel>

            <Panel title="What to watch" description="Rule-based signals from the numbers above.">
              <ul className="space-y-2.5">
                {insights.map((insight) => (
                  <Insight key={insight.title} {...insight} />
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </main>
  );
}
