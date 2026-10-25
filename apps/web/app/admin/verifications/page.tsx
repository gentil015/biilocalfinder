'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileCheck2, IdCard, Building2, Wrench, FileStack, ArrowRight } from 'lucide-react';
import { adminVerificationApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED'];

const TYPE_LABEL: Record<string, string> = {
  IDENTITY: 'Identity',
  BUSINESS: 'Business',
  SERVICE: 'Service',
};

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function AdminVerificationsPage() {
  const [status, setStatus] = useState('PENDING');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminVerificationApi
      .queue({ status })
      .then(setData)
      .finally(() => setLoading(false));
  }, [status]);

  const items: any[] = data?.items ?? [];
  const countOf = (type: string) => items.filter((i) => i.type === type).length;

  return (
    <main className="page-workspace py-6 md:py-8">
      <PageHeader
        eyebrow="Admin · Moderation"
        title="Verification queue"
        description="Identity and business documents submitted by providers. Oldest first — the queue is worked in submission order."
      />

      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter queue by status">
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
            icon={FileCheck2}
            label="In queue"
            value={String(data?.total ?? items.length)}
            sub={statusLabel(status)}
            tone={status === 'PENDING' ? 'brand' : 'neutral'}
          />
          <StatCard icon={IdCard} label="Identity" value={String(countOf('IDENTITY'))} sub="On this page" />
          <StatCard icon={Building2} label="Business" value={String(countOf('BUSINESS'))} sub="On this page" />
          <StatCard icon={Wrench} label="Service" value={String(countOf('SERVICE'))} sub="On this page" />
        </div>
      )}

      {loading && <LoadingBlock label="Loading the queue…" />}

      {!loading && items.length === 0 && (
        <EmptyState
          icon={FileStack}
          title={`Nothing ${statusLabel(status).toLowerCase()}`}
          body="No providers are waiting on a decision in this state. Try another status above."
        />
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="space-y-3 md:hidden">
            {items.map((r: any) => (
              <Link
                key={r.id}
                href={`/admin/verifications/${r.id}`}
                className="surface-card-interactive block p-4"
                aria-label={`Review ${r.provider.businessName}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-950">{r.provider.businessName}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {r.provider.user?.firstName} {r.provider.user?.lastName}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-500">
                  <span className="chip px-2 py-0.5 text-2xs font-semibold">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                  <span className="tabular">{new Date(r.submittedAt).toLocaleDateString()}</span>
                  <span className="tabular">
                    {r.documents.length} {r.documents.length === 1 ? 'document' : 'documents'}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700">
                    Review
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <Panel bodyClassName="p-0" className="hidden md:block">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Provider</th>
                    <th scope="col" className="w-28">
                      Type
                    </th>
                    <th scope="col" className="w-32">
                      Submitted
                    </th>
                    <th scope="col" className="w-24 text-right">
                      Documents
                    </th>
                    <th scope="col" className="w-28">
                      Status
                    </th>
                    <th scope="col" className="w-28 text-right">
                      <span className="sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r: any) => (
                    <tr key={r.id}>
                      <td className="max-w-[20rem]">
                        <Link href={`/admin/verifications/${r.id}`} className="group block min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-950 group-hover:text-brand-700">
                            {r.provider.businessName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-ink-500">
                            {r.provider.user?.firstName} {r.provider.user?.lastName}
                          </p>
                        </Link>
                      </td>
                      <td>
                        <span className="chip px-2 py-0.5 text-2xs font-semibold">
                          {TYPE_LABEL[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap tabular text-xs text-ink-500">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="text-right tabular text-sm font-semibold text-ink-900">
                        {r.documents.length}
                      </td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/verifications/${r.id}`}
                          className="btn-secondary btn-sm"
                          aria-label={`Review ${r.provider.businessName}`}
                        >
                          Review
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </main>
  );
}
