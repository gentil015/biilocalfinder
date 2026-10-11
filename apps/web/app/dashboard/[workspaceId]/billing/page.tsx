'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard, Gauge, Wallet } from 'lucide-react';
import {
  ApiError,
  subscriptionsApi,
  workspacesApi,
  type ProviderSubscription,
  type SubscriptionPlan,
  type UsageSummary,
  type WorkspaceType,
} from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, LoadingBlock } from '@/components/ui/page';

// spec §7: "Display plan limits and usage to workspace owners", "Provide
// clear upgrade and downgrade flows", and — critically — plans are
// filtered to the workspace's own type before they're even shown, on top
// of the backend rejecting a mismatched planId regardless (see
// EntitlementsService.assertPlanMatchesType — hiding the wrong plans
// here is a UX nicety, not the actual authorization).
export default function BillingPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [current, setCurrent] = useState<ProviderSubscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspacesApi.getContext(workspaceId).then((ws) => {
      setWorkspaceType(ws.type);
      subscriptionsApi.listPlans(ws.type).then(setPlans);
    });
    subscriptionsApi.current().then(setCurrent);
    subscriptionsApi.usage().then(setUsage);
  }, [workspaceId]);

  async function subscribe(plan: SubscriptionPlan) {
    setError(null);
    setBusyPlanId(plan.id);
    try {
      const sub = await subscriptionsApi.subscribe(plan.id);
      setCurrent(sub);
      subscriptionsApi.usage().then(setUsage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start this plan');
    } finally {
      setBusyPlanId(null);
    }
  }

  async function cancel() {
    if (!current) return;
    setBusyPlanId(current.id);
    try {
      const sub = await subscriptionsApi.cancel(current.id);
      setCurrent(sub);
    } finally {
      setBusyPlanId(null);
    }
  }

  if (!plans || !workspaceType) return <LoadingBlock label="Loading your plan…" />;

  const active = current?.status === 'ACTIVE' ? current : null;
  const summaryPlan = active?.plan ?? usage?.plan ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Subscription & billing"
        description="Downgrading never deletes anything you've already added — you just can't add more of what's over the new limit until you're back under it."
      />

      {error && (
        <p className="error-text mb-4" role="alert">
          {error}
        </p>
      )}

      {active && (
        <div className="surface-card mb-6 flex flex-wrap items-center justify-between gap-4 border-brand-200 bg-brand-50/60 p-5">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Current plan</p>
            <p className="font-display text-lg font-extrabold text-brand-900">{active.plan.name}</p>
            <p className="mt-0.5 text-sm text-brand-700">
              {priceOf(active.plan)}
              {Number(active.plan.price) > 0 &&
                ` / ${active.plan.billingInterval === 'YEARLY' ? 'year' : 'month'}`}
              {active.renewalDate && ` · renews ${new Date(active.renewalDate).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={active.status} />
            <button
              type="button"
              onClick={cancel}
              disabled={busyPlanId === active.id}
              className="btn-secondary btn-sm"
            >
              {busyPlanId === active.id ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Wallet}
          label="Plan"
          tone={active ? 'success' : 'warning'}
          value={summaryPlan?.name ?? 'Free'}
          sub={active ? 'Renewing automatically' : 'No active subscription'}
        />
        <StatCard
          icon={CreditCard}
          label="Price"
          value={summaryPlan ? priceOf(summaryPlan) : 'Free'}
          sub={summaryPlan && Number(summaryPlan.price) > 0 ? `per ${summaryPlan.billingInterval === 'YEARLY' ? 'year' : 'month'}` : 'Nothing to pay'}
        />
        <StatCard
          icon={Gauge}
          label="Services used"
          value={String(usage?.resources.find((r) => r.resource === 'services')?.used ?? 0)}
          sub={
            usage?.resources.find((r) => r.resource === 'services')?.limit == null
              ? 'Unlimited'
              : `of ${usage?.resources.find((r) => r.resource === 'services')?.limit} allowed`
          }
        />
        <StatCard
          icon={Check}
          label="Billing since"
          value={current ? new Date(current.startDate).toLocaleDateString() : '—'}
          sub={current ? 'Current term started' : 'Nothing billed yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-4">
          {usage && (
            <Panel
              title="Usage against your plan"
              description="Anything at its limit can't be added to until you upgrade or clear space."
              bodyClassName="p-0"
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Resource</th>
                      <th scope="col" className="w-24 text-right">
                        Used
                      </th>
                      <th scope="col" className="w-24 text-right">
                        Limit
                      </th>
                      <th scope="col" className="w-1/3">
                        Share of limit
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.resources
                      .filter((r) => r.limit !== 0)
                      .map((r) => {
                        const over = r.limit != null && r.used >= r.limit;
                        const pct = r.limit ? Math.min(100, Math.round((r.used / r.limit) * 100)) : 0;
                        return (
                          <tr key={r.resource}>
                            <td className="text-sm font-semibold text-ink-900">{r.label}</td>
                            <td className="text-right tabular text-sm font-bold text-ink-950">{r.used}</td>
                            <td className="text-right tabular text-sm text-ink-500">
                              {r.limit == null ? '∞' : r.limit}
                            </td>
                            <td>
                              {r.limit == null ? (
                                <span className="text-xs text-ink-400">Unlimited on this plan</span>
                              ) : (
                                <span className="flex items-center gap-2.5">
                                  <span className="h-1.5 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-ink-100">
                                    <span
                                      className={`block h-full rounded-full ${over ? 'bg-danger-500' : 'bg-brand-500'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </span>
                                  <span
                                    className={`w-9 shrink-0 text-right text-xs font-semibold tabular ${
                                      over ? 'text-danger-600' : 'text-ink-500'
                                    }`}
                                  >
                                    {pct}%
                                  </span>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel
            title="Choose a plan"
            description={`Only plans valid for a ${workspaceType.toLowerCase()} workspace are listed — the backend rejects anything else regardless.`}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = current?.status === 'ACTIVE' && current.plan.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`surface-card flex flex-col p-4 ${isCurrent ? 'border-brand-300 ring-4 ring-brand-500/10' : ''}`}
                  >
                    <p className="card-title">{plan.name}</p>
                    <p className="mt-1 font-display text-lg font-extrabold tabular text-ink-950">
                      {priceOf(plan)}
                      {Number(plan.price) > 0 && (
                        <span className="text-xs font-medium text-ink-400">
                          /{plan.billingInterval === 'YEARLY' ? 'yr' : 'mo'}
                        </span>
                      )}
                    </p>
                    <ul className="my-3 flex-1 space-y-1.5 text-xs text-ink-500">
                      <PlanLimitLine label="Services" limit={plan.maxServices} />
                      <PlanLimitLine label="Portfolio items" limit={plan.maxPortfolioImages} />
                      {plan.maxTeamMembers != null && <PlanLimitLine label="Team members" limit={plan.maxTeamMembers} />}
                      {plan.maxManagedProviders != null && (
                        <PlanLimitLine label="Managed providers" limit={plan.maxManagedProviders} />
                      )}
                    </ul>
                    <button
                      type="button"
                      onClick={() => subscribe(plan)}
                      disabled={isCurrent || busyPlanId === plan.id}
                      className={`w-full ${isCurrent ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}`}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Current plan
                        </>
                      ) : busyPlanId === plan.id ? (
                        'Starting…'
                      ) : (
                        'Choose plan'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Plan summary">
            <dl className="detail-list">
              <div className="detail-row">
                <dt className="detail-key">Plan</dt>
                <dd className="detail-value">{summaryPlan?.name ?? 'Free'}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Price</dt>
                <dd className="detail-value tabular">
                  {summaryPlan ? priceOf(summaryPlan) : 'Free'}
                  {summaryPlan && Number(summaryPlan.price) > 0 && (
                    <span className="ml-1 text-xs font-medium text-ink-400">
                      /{summaryPlan.billingInterval === 'YEARLY' ? 'yr' : 'mo'}
                    </span>
                  )}
                </dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Status</dt>
                <dd className="detail-value">{current ? <StatusBadge status={current.status} /> : '—'}</dd>
              </div>
              <div className="detail-row">
                <dt className="detail-key">Workspace type</dt>
                <dd className="detail-value">{workspaceType.charAt(0) + workspaceType.slice(1).toLowerCase()}</dd>
              </div>
            </dl>
            <p className="hint">
              Limits are enforced on the backend — they aren&apos;t just hidden in this screen.
            </p>
          </Panel>

          <Panel title="Current term" bodyClassName="p-0">
            {current ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" className="text-right">
                        Amount
                      </th>
                      <th scope="col" className="text-right">
                        Renews
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <p className="text-sm font-semibold text-ink-950">{current.plan.name}</p>
                        <p className="mt-0.5 text-xs tabular text-ink-500">
                          From {new Date(current.startDate).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="text-sm font-bold tabular text-ink-900">{priceOf(current.plan)}</span>
                        {Number(current.plan.price) > 0 && (
                          <span className="block text-2xs font-medium text-ink-400">
                            {current.plan.currency} ·{' '}
                            {current.plan.billingInterval === 'YEARLY' ? 'yearly' : 'monthly'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <span className="text-sm font-semibold tabular text-ink-700">
                          {current.renewalDate ? new Date(current.renewalDate).toLocaleDateString() : '—'}
                        </span>
                        <span className="mt-0.5 block">
                          <StatusBadge status={current.status} />
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-ink-500">
                No active subscription — you&apos;re on the free tier and nothing is being charged.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function priceOf(plan: SubscriptionPlan) {
  return Number(plan.price) === 0
    ? 'Free'
    : `${Number(plan.price).toLocaleString()} ${plan.currency}`;
}

function PlanLimitLine({ label, limit }: { label: string; limit: number | null }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-semibold tabular text-ink-700">{limit == null ? 'Unlimited' : limit}</span>
    </li>
  );
}
