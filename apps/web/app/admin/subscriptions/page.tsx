'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CreditCard, Search, Wallet } from 'lucide-react';
import { adminApi, type AdminSubscription, type AdminSubscriptionsPage } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, LoadingBlock, PageHeader, Panel, StatCard } from '@/components/ui/page';

const PAGE_SIZE = 20;

const STATUSES: { label: string; value: AdminSubscription['status'] | '' }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Past due', value: 'PAST_DUE' },
  { label: 'Trialing', value: 'TRIALING' },
  { label: 'Expired', value: 'EXPIRED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PROVIDER_TYPES = [
  { label: 'All provider types', value: '' },
  { label: 'Individual', value: 'INDIVIDUAL' },
  { label: 'Team', value: 'TEAM' },
  { label: 'Business', value: 'BUSINESS' },
  { label: 'Agency', value: 'AGENCY' },
] as const;

function isExpiringSoon(renewalDate: string | null) {
  if (!renewalDate) return false;
  const renewal = new Date(renewalDate).getTime();
  const now = Date.now();
  return renewal >= now && renewal <= now + 30 * 24 * 60 * 60 * 1000;
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
}

function providerTypeLabel(value: string | null) {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : 'Not selected';
}

export default function AdminSubscriptionsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminSubscription['status'] | ''>('');
  const [providerType, setProviderType] = useState<(typeof PROVIDER_TYPES)[number]['value']>('');
  const [billingIssuesOnly, setBillingIssuesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminSubscriptionsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminApi
      .subscriptions({
        search,
        status: status || undefined,
        providerType: providerType || undefined,
        billingIssues: billingIssuesOnly,
        page,
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load subscriptions');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [search, status, providerType, billingIssuesOnly, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Billing oversight"
        title="Provider subscriptions"
        description="Monitor platform subscription plans, renewal dates and billing outcomes. Client-to-provider service payments are not processed by this platform."
      />

      {error && (
        <div className="alert alert-error mb-4" role="alert">
          {error}
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Active plans"
          value={String(data?.stats.active ?? '—')}
          sub="Currently active subscriptions"
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Past due"
          value={String(data?.stats.pastDue ?? '—')}
          sub="Subscription status"
          tone={data && data.stats.pastDue > 0 ? 'warning' : 'neutral'}
        />
        <StatCard
          icon={CalendarClock}
          label="Renewing soon"
          value={String(data?.stats.expiringSoon ?? '—')}
          sub="Within the next 30 days"
        />
        <StatCard
          icon={CreditCard}
          label="Billing issues"
          value={String(data?.stats.billingIssues ?? '—')}
          sub="Past due or latest payment failed"
          tone={data && data.stats.billingIssues > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <Panel className="mb-5" bodyClassName="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_12rem_14rem]">
          <label className="relative block">
            <span className="sr-only">Search provider or plan</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search provider, email, or plan"
              className="w-full pl-9"
            />
          </label>
          <label>
            <span className="sr-only">Filter by subscription status</span>
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value as AdminSubscription['status'] | '');
              }}
              className="w-full"
            >
              {STATUSES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filter by provider type</span>
            <select
              value={providerType}
              onChange={(event) => {
                setPage(1);
                setProviderType(event.target.value as (typeof PROVIDER_TYPES)[number]['value']);
              }}
              className="w-full"
            >
              {PROVIDER_TYPES.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-700">
          <input
            type="checkbox"
            checked={billingIssuesOnly}
            onChange={(event) => {
              setPage(1);
              setBillingIssuesOnly(event.target.checked);
            }}
            className="h-4 w-4 rounded border-ink-300 text-brand-700 focus:ring-brand-500"
          />
          Show billing issues only
        </label>
      </Panel>

      {loading && <LoadingBlock label="Loading provider subscriptions…" />}

      {!loading && data?.items.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No subscriptions found"
          body="Try another search term or adjust the filters."
        />
      )}

      {!loading && data && data.items.length > 0 && (
        <Panel
          title={`${data.total.toLocaleString()} ${data.total === 1 ? 'subscription' : 'subscriptions'}`}
          description={`Page ${data.page} of ${totalPages}`}
          bodyClassName="p-0"
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Plan</th>
                  <th scope="col" className="w-28">Status</th>
                  <th scope="col" className="w-36">Renewal / end</th>
                  <th scope="col">Latest billing</th>
                  <th scope="col" className="w-28">Started</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((subscription) => {
                  const transaction = subscription.transactions[0];
                  const failedPayment = transaction?.paymentStatus === 'FAILED';
                  const pastDue = subscription.status === 'PAST_DUE';
                  const expiringSoon = isExpiringSoon(subscription.renewalDate);
                  const dateLabel = subscription.endDate
                    ? 'Ends'
                    : subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED'
                      ? 'Ended'
                      : 'Renews';
                  return (
                    <tr key={subscription.id}>
                      <td>
                        <span className="block font-semibold text-ink-900">{subscription.provider.businessName}</span>
                        <span className="block text-xs text-ink-500">
                          {subscription.provider.user.firstName} {subscription.provider.user.lastName}
                        </span>
                        <span className="block text-xs text-ink-400">{subscription.provider.user.email}</span>
                        <span className="mt-1 block text-2xs uppercase tracking-wide text-ink-400">
                          {providerTypeLabel(subscription.provider.providerType)}
                        </span>
                      </td>
                      <td>
                        <span className="block font-semibold text-ink-800">{subscription.plan.name}</span>
                        <span className="block text-xs text-ink-500">
                          {formatMoney(subscription.plan.price, subscription.plan.currency)} / {subscription.plan.billingInterval === 'YEARLY' ? 'year' : 'month'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={subscription.status} />
                        {(pastDue || failedPayment) && (
                          <span className="mt-1 block text-2xs font-semibold text-warning-700">
                            {pastDue && failedPayment ? 'Past due · payment failed' : pastDue ? 'Past due' : 'Payment failed'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="block text-sm text-ink-700">
                          {dateLabel}{' '}
                          {formatDate(subscription.endDate ?? subscription.renewalDate)}
                        </span>
                        {expiringSoon && subscription.status !== 'CANCELLED' && (
                          <span className="mt-1 inline-block rounded-full bg-warning-50 px-2 py-0.5 text-2xs font-bold text-warning-700">
                            Within 30 days
                          </span>
                        )}
                      </td>
                      <td>
                        {transaction ? (
                          <>
                            <span className="block text-sm font-semibold text-ink-800">
                              {formatMoney(transaction.amount, transaction.currency)}
                            </span>
                            <span className="block text-xs text-ink-500">
                              {transaction.paymentProvider.replace(/_/g, ' ')} · {formatDate(transaction.createdAt)}
                            </span>
                            <StatusBadge status={transaction.paymentStatus} />
                          </>
                        ) : (
                          <span className="text-sm text-ink-400">No billing record</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-sm text-ink-500">{formatDate(subscription.startDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="text-sm tabular text-ink-500">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}
