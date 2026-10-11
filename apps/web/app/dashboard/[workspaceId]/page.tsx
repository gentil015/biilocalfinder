'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Network,
  Star,
  ShieldCheck,
  Wallet,
  Inbox,
  CalendarClock,
  ArrowRight,
  CheckCircle2,
  Circle,
  TrendingUp,
  Check,
} from 'lucide-react';
import { providerInsightsApi, workspacesApi, type Workspace, type WorkspaceMember } from '@/lib/api';
import { PageHeader, Panel, StatCard, LoadingBlock } from '@/components/ui/page';

interface ProviderInsights {
  recommendedActions: { action: string; label: string }[];
  opportunities: { serviceId: string; serviceName: string; categoryName: string; approximateInterestedUsers: number }[];
  profileStrength: { percent: number; checklist: { id: string; label: string; checked: boolean }[] };
}

const HAS_ROSTER = new Set(['TEAM', 'BUSINESS', 'AGENCY']);

// One overview component, tailored per type by what data it fetches and
// which extra cards it renders — not four separate pages (spec §6).
export default function WorkspaceOverviewPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [workspace, setWorkspace] = useState<(Workspace & { memberships: { id: string; role: string }[] }) | null>(null);
  const [insights, setInsights] = useState<ProviderInsights | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      workspacesApi.getContext(workspaceId),
      providerInsightsApi.get().catch(() => null),
    ]).then(([ws, ins]) => {
      setWorkspace(ws);
      setInsights(ins);
      setLoading(false);
      if (HAS_ROSTER.has(ws.type)) {
        workspacesApi.listMembers(workspaceId).then(setMembers).catch(() => setMembers([]));
      }
    });
  }, [workspaceId]);

  if (loading || !workspace) return <LoadingBlock label="Loading your overview…" />;

  const provider = workspace.provider;
  const activeMemberCount = members?.filter((m) => m.status === 'ACTIVE').length ?? null;

  return (
    <>
      <PageHeader
        eyebrow={`${typeLabel(workspace.type)} workspace`}
        title={workspace.name}
        description="Quick links and opportunities based on marketplace-wide activity — never any individual client's private searches or messages."
      />

      {provider && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Star}
            label="Rating"
            value={provider.rating ? provider.rating.toFixed(1) : '—'}
            sub={`${provider.reviewCount} reviews`}
          />
          <StatCard
            icon={ShieldCheck}
            label="Verification"
            tone={provider.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}
            value={provider.verificationStatus === 'VERIFIED' ? 'Verified' : 'Unverified'}
            sub={provider.verificationStatus === 'VERIFIED' ? 'Trust badge live' : 'Action required'}
          />
          <StatCard
            icon={Wallet}
            label="Plan"
            tone={provider.subscriptionStatus === 'ACTIVE' ? 'success' : 'warning'}
            value={provider.subscriptionStatus === 'ACTIVE' ? 'Active' : 'Expired'}
            sub={provider.subscriptionStatus === 'ACTIVE' ? 'All features' : 'Renew to continue'}
          />
          <StatCard
            icon={Users}
            label="Members"
            value={activeMemberCount != null ? String(activeMemberCount) : '—'}
            sub="Active dashboard users"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/provider/requests" className="surface-card-interactive group flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Inbox className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-950">Incoming requests</p>
            <p className="mt-0.5 text-xs text-ink-500">Quote work that matches your services</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" aria-hidden="true" />
        </Link>

        <Link href="/bookings" className="surface-card-interactive group flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600">
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-950">Bookings</p>
            <p className="mt-0.5 text-xs text-ink-500">Scheduled, active and completed work</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" aria-hidden="true" />
        </Link>
      </div>

      {workspace.type === 'TEAM' && (
        <RosterCard
          className="mt-4"
          icon={Users}
          title="Team"
          count={activeMemberCount}
          description="People with access to this team's dashboard"
          href={`/dashboard/${workspaceId}/members`}
        />
      )}
      {workspace.type === 'BUSINESS' && (
        <RosterCard
          className="mt-4"
          icon={Users}
          title="Staff"
          count={activeMemberCount}
          description="Staff with access to this business's dashboard"
          href={`/dashboard/${workspaceId}/members`}
        />
      )}
      {workspace.type === 'AGENCY' && (
        <RosterCard
          className="mt-4"
          icon={Network}
          title="Managed providers"
          count={null}
          description="Providers this agency represents or manages"
          href={`/dashboard/${workspaceId}/managed-providers`}
        />
      )}

      {insights && (
        <Panel
          className="mt-6"
          title="Profile strength"
          description="Complete these to rank higher in search."
          actions={
            <span
              className={`font-display text-xl font-extrabold tabular ${
                insights.profileStrength.percent === 100 ? 'text-success-600' : 'text-brand-700'
              }`}
            >
              {insights.profileStrength.percent}%
            </span>
          }
        >
          <div
            className="mb-5 h-2 overflow-hidden rounded-full bg-ink-100"
            role="progressbar"
            aria-valuenow={insights.profileStrength.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile strength"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                insights.profileStrength.percent === 100 ? 'bg-success-500' : 'bg-brand-600'
              }`}
              style={{ width: `${insights.profileStrength.percent}%` }}
            />
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {insights.profileStrength.checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 text-sm">
                {item.checked ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                )}
                <span className={item.checked ? 'text-ink-500' : 'font-medium text-ink-800'}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {insights?.opportunities && insights.opportunities.length > 0 && (
        <Panel
          className="mt-6"
          title="Opportunities near you"
          description="Services with demand in your area that you don't cover yet."
        >
          <ul className="divide-y divide-ink-100">
            {insights.opportunities.slice(0, 5).map((o) => (
              <li key={o.serviceId} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink-950">{o.serviceName}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{o.categoryName}</p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold tabular text-ink-950">
                    {o.approximateInterestedUsers}
                  </span>
                  <span className="block text-2xs text-ink-500">interested users</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {insights && insights.recommendedActions?.length > 0 && (
        <Panel className="mt-6" title="Recommended next steps">
          <ul className="space-y-2">
            {insights.recommendedActions.map((a) => (
              <li key={a.action} className="flex items-center gap-2.5 text-sm text-ink-700">
                <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                {a.label}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function typeLabel(type: string) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function RosterCard({
  icon: Icon,
  title,
  count,
  description,
  href,
  className = '',
}: {
  icon: typeof Users;
  title: string;
  count: number | null;
  description: string;
  href: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`surface-card-interactive group flex items-center gap-4 p-5 ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-accent-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink-950">
          {title}
          {count != null && <span className="ml-1.5 font-semibold text-ink-400">{count}</span>}
        </p>
        <p className="mt-0.5 text-xs text-ink-500">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" aria-hidden="true" />
    </Link>
  );
}
