'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ClipboardList,
  CreditCard,
  Flag,
  FolderTree,
  History,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { adminApi, type AdminDashboardStats } from '@/lib/api';
import { PageHeader, Panel, StatCard, Skeleton, EmptyState } from '@/components/ui/page';

const QUEUES: { href: string; label: string; description: string; icon: LucideIcon; stat?: keyof AdminDashboardStats }[] = [
  {
    href: '/admin/audit-logs',
    label: 'Audit logs',
    description: 'Review administrative actions and changes made across the platform.',
    icon: History,
  },
  {
    href: '/admin/subscriptions',
    label: 'Subscriptions',
    description: 'Monitor provider plans, renewals, expirations and billing issues.',
    icon: CreditCard,
  },
  {
    href: '/admin/users',
    label: 'User management',
    description: 'Search accounts, review account status and manage access to the platform.',
    icon: Users,
  },
  {
    href: '/admin/provider-applications',
    label: 'Provider applications',
    description: 'Clients asking to trade here. Approving upgrades their existing account.',
    icon: UserCog,
    stat: 'pendingProviderApplications',
  },
  {
    href: '/admin/verifications',
    label: 'Verifications',
    description: 'Review identity and business documents before a provider badge goes live.',
    icon: ShieldCheck,
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    description: 'Fraud, fake listings and impersonation reports raised by users.',
    icon: Flag,
    stat: 'openReports',
  },
  {
    href: '/admin/disputes',
    label: 'Disputes',
    description: 'Booking and quote disputes between clients and providers.',
    icon: Scale,
    stat: 'openDisputes',
  },
  {
    href: '/admin/categories',
    label: 'Categories',
    description: 'The service taxonomy every provider, search and filter depends on.',
    icon: FolderTree,
  },
  {
    href: '/admin/personalization',
    label: 'Personalization',
    description: 'Tune the ranking weights that decide which providers surface first.',
    icon: SlidersHorizontal,
  },
];

export default function AdminHomePage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the dashboard'));
  }, []);

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin"
        title="Moderation console"
        description="Everything that needs a human decision: verifications, reports, disputes and the catalogue they depend on."
      />

      {error && (
        <div className="alert alert-error mb-6" role="alert">
          <span>{error}</span>
        </div>
      )}

      <section aria-label="Platform totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard
              icon={Users}
              label="Users"
              value={String(stats.totalUsers)}
              sub={`${stats.totalProviders} provider${stats.totalProviders === 1 ? '' : 's'}`}
            />
            <StatCard
              icon={ShieldCheck}
              label="Verified providers"
              value={String(stats.verifiedProviders)}
              sub={`of ${stats.totalProviders} total`}
              tone={stats.verifiedProviders > 0 ? 'success' : 'neutral'}
            />
            <StatCard
              icon={ClipboardList}
              label="Open bookings"
              value={String(stats.activeBookings)}
              sub={`${stats.completedBookings} completed`}
            />
            <StatCard
              icon={Flag}
              label="Needs attention"
              value={String(stats.openReports + stats.openDisputes)}
              sub={`${stats.openReports} reports · ${stats.openDisputes} disputes`}
              tone={stats.openReports + stats.openDisputes > 0 ? 'warning' : 'neutral'}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        )}
      </section>

      <section aria-label="Moderation queues" className="mt-6">
        <Panel title="Queues">
          <ul className="grid gap-2 sm:grid-cols-2">
            {QUEUES.map(({ href, label, description, icon: Icon, stat }) => {
              const count = stats && stat ? stats[stat] : null;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-start gap-3 rounded-xl border border-ink-200 p-4 transition hover:border-ink-300 hover:bg-ink-50"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink-900">{label}</span>
                        {count != null && count > 0 && (
                          <span className="rounded-full bg-warning-50 px-1.5 py-0.5 text-2xs font-bold text-warning-700">
                            {count} open
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm leading-relaxed text-ink-600">{description}</span>
                    </span>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-500"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      </section>

      {stats && stats.totalProviders === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={Users}
            title="No providers yet"
            body="The marketplace has nothing to moderate until providers sign up and publish a profile."
          />
        </div>
      )}
    </main>
  );
}
