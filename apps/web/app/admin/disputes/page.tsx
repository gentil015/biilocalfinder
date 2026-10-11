'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquareWarning, Paperclip, MessagesSquare, Timer, ArrowRight } from 'lucide-react';
import { adminDisputesApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

const STATUSES = ['OPEN', 'RESPONDED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

const CATEGORY_LABEL: Record<string, string> = {
  SERVICE_NOT_AS_DESCRIBED: 'Not as described',
  NO_SHOW: 'No-show',
  DAMAGE_OR_LOSS: 'Damage or loss',
  UNPROFESSIONAL_CONDUCT: 'Conduct',
  PAYMENT_DISAGREEMENT: 'Payment',
  OTHER: 'Other',
};

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase();
}

function ageInDays(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function AdminDisputesPage() {
  const [status, setStatus] = useState('UNDER_REVIEW');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminDisputesApi
      .list(status)
      .then(setData)
      .finally(() => setLoading(false));
  }, [status]);

  const items: any[] = data?.items ?? [];
  // The queue is ordered oldest first, so the head of the list is the item
  // that has been waiting longest — the number that decides what to pick next.
  const oldestDays = items.length > 0 ? ageInDays(items[0].createdAt) : 0;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Moderation"
        title="Disputes"
        description="Structured problem reports between clients and providers. Oldest first — the queue is worked in the order it arrived."
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter disputes by status">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            aria-pressed={status === s}
            className={`chip-interactive ${status === s ? 'chip-active' : ''}`}
          >
            {statusLabel(s)}
          </button>
        ))}
      </div>

      {!loading && items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={MessageSquareWarning}
            label="In queue"
            tone={status === 'UNDER_REVIEW' ? 'brand' : 'neutral'}
            value={String(data?.total ?? items.length)}
            sub={statusLabel(status)}
          />
          <StatCard
            icon={MessagesSquare}
            label="With messages"
            value={String(items.filter((d) => d._count.messages > 0).length)}
            sub="On this page"
          />
          <StatCard
            icon={Paperclip}
            label="With evidence"
            value={String(items.filter((d) => d._count.evidence > 0).length)}
            sub="On this page"
          />
          <StatCard
            icon={Timer}
            label="Oldest"
            tone={oldestDays > 3 ? 'warning' : 'neutral'}
            value={`${oldestDays}d`}
            sub="Waiting"
          />
        </div>
      )}

      {loading && <LoadingBlock label="Loading disputes…" />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={MessageSquareWarning}
          title={`Nothing ${statusLabel(status)}`}
          body="No disputes are sitting in this state. Try another status above."
        />
      )}

      {!loading && items.length > 0 && (
        <Panel bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Dispute</th>
                  <th scope="col">Parties</th>
                  <th scope="col" className="w-32">
                    Booking
                  </th>
                  <th scope="col" className="w-32 text-right">
                    Activity
                  </th>
                  <th scope="col" className="w-28">
                    Status
                  </th>
                  <th scope="col" className="w-28 text-right">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((d: any) => (
                  <tr key={d.id}>
                    <td className="max-w-[20rem]">
                      <Link href={`/admin/disputes/${d.id}`} className="group block min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-950 group-hover:text-brand-700">
                          {d.reason}
                        </p>
                        <p className="mt-1 text-xs text-ink-500">
                          {CATEGORY_LABEL[d.category] ?? d.category.replace(/_/g, ' ').toLowerCase()}
                        </p>
                      </Link>
                    </td>
                    <td className="text-xs text-ink-600">
                      <span className="block truncate">
                        {d.raisedBy.firstName} {d.raisedBy.lastName}
                      </span>
                      <span className="block truncate text-ink-400">vs {d.respondent.firstName} {d.respondent.lastName}</span>
                    </td>
                    <td>
                      <span className="block text-xs tabular text-ink-500">#{d.booking.id.slice(0, 8)}</span>
                      <StatusBadge status={d.booking.status} />
                    </td>
                    <td className="text-right">
                      <span className="block text-sm font-semibold tabular text-ink-900">
                        {d._count.messages}
                        <span className="ml-1 text-2xs font-medium uppercase tracking-wide text-ink-400">msg</span>
                      </span>
                      <span className="block text-xs tabular text-ink-500">{d._count.evidence} evidence</span>
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/admin/disputes/${d.id}`}
                        className="btn-secondary btn-sm"
                        aria-label={`Open dispute ${d.reason}`}
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
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
