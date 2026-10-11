'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Briefcase, Clock, UserCog } from 'lucide-react';
import { adminProviderApplicationsApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function AdminProviderApplicationsPage() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('PENDING');
  const [items, setItems] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // One unfiltered fetch keeps the stat cards accurate no matter which chip
    // is selected; the visible list is filtered client-side.
    adminProviderApplicationsApi
      .list()
      .then((rows) => {
        setAll(rows);
        setItems(rows.filter((r) => r.status === status));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-filter when the chip changes without refetching.
  useEffect(() => {
    setItems(all.filter((r) => r.status === status));
  }, [status, all]);

  const pendingCount = all.filter((r) => r.status === 'PENDING').length;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Moderation"
        title="Provider applications"
        description="Clients asking to trade on the platform. Approving upgrades their existing account in place — same login, same history. Oldest first."
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter applications by status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`chip-interactive ${status === s ? 'chip-active' : ''}`}
          >
            {statusLabel(s)}
            {s === 'PENDING' && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {all.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            icon={Clock}
            label="Awaiting review"
            value={String(pendingCount)}
            sub="Needs a decision"
            tone={pendingCount > 0 ? 'brand' : 'neutral'}
          />
          <StatCard icon={UserCog} label="Approved" value={String(all.filter((r) => r.status === 'APPROVED').length)} sub="All time" />
          <StatCard icon={Briefcase} label="Rejected" value={String(all.filter((r) => r.status === 'REJECTED').length)} sub="All time" />
        </div>
      )}

      {loading && <LoadingBlock label="Loading applications…" />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={Briefcase}
          title={`Nothing ${statusLabel(status).toLowerCase()}`}
          body="No provider applications are in this state. Try another status above."
        />
      )}

      {!loading && items.length > 0 && (
        <Panel bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Applicant</th>
                  <th scope="col">Business</th>
                  <th scope="col" className="w-28">
                    Type
                  </th>
                  <th scope="col" className="w-24 text-right">
                    Services
                  </th>
                  <th scope="col" className="w-32">
                    Submitted
                  </th>
                  <th scope="col" className="w-28">
                    Status
                  </th>
                  <th scope="col" className="w-24 text-right">
                    <span className="sr-only">Review</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="block font-semibold text-ink-900">
                        {a.user?.firstName} {a.user?.lastName}
                      </span>
                      <span className="block text-xs text-ink-400">{a.user?.email}</span>
                    </td>
                    <td>
                      <span className="block text-ink-800">{a.businessName}</span>
                      {a.phone && <span className="block text-xs text-ink-400">{a.phone}</span>}
                    </td>
                    <td className="text-xs uppercase text-ink-500">{a.providerType}</td>
                    <td className="text-right tabular">{a.categories?.length ?? 0}</td>
                    <td className="whitespace-nowrap text-xs text-ink-500">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/provider-applications/${a.id}`}
                        className="btn-secondary btn-sm whitespace-nowrap"
                      >
                        Review <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </main>
  );
}