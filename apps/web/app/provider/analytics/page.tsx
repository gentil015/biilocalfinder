'use client';

import { useEffect, useState } from 'react';
import { Eye, MessageSquare, Percent, Search, ShoppingBag, TrendingUp, AlertCircle } from 'lucide-react';
import { providerAnalyticsApi, ProviderAnalyticsSummary } from '@/lib/api';
import { PageHeader, Panel, StatCard, LoadingBlock } from '@/components/ui/page';

export default function ProviderAnalyticsPage() {
  const [data, setData] = useState<ProviderAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    providerAnalyticsApi
      .get()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading analytics…" />
      </main>
    );

  if (!data)
    return (
      <main className="page-narrow py-6 md:py-8">
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Couldn&apos;t load analytics.
        </div>
      </main>
    );

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader eyebrow="Provider" title="Analytics" description={data.periodLabel} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Eye} label="Profile views" value={String(data.profileViews)} />
        <StatCard icon={Eye} label="Service views" value={String(data.serviceViews)} />
        <StatCard icon={MessageSquare} label="Requests" value={String(data.requests)} />
        <StatCard icon={ShoppingBag} label="Quotes sent" value={String(data.quotesSent)} />
        <StatCard icon={TrendingUp} label="Bookings" value={String(data.bookings)} />
        <StatCard icon={Percent} label="Conversion" value={`${data.conversionRate}%`} />
      </div>

      <Panel title="Trending services" description="Which of your services are drawing the most attention." className="mb-6">
        <dl className="detail-list">
          <div className="detail-row">
            <dt className="flex items-center gap-2">
              <Search className="h-4 w-4 text-ink-400" aria-hidden="true" />
              <span className="detail-key">Top searched service</span>
            </dt>
            <dd className={`detail-value ${!data.topSearchedService ? 'font-medium text-ink-400' : ''}`}>
              {data.topSearchedService ? data.topSearchedService.serviceName : 'Not enough data yet'}
            </dd>
          </div>
          <div className="detail-row">
            <dt className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-ink-400" aria-hidden="true" />
              <span className="detail-key">Most viewed service</span>
            </dt>
            <dd className={`detail-value ${!data.mostViewedService ? 'font-medium text-ink-400' : ''}`}>
              {data.mostViewedService ? data.mostViewedService.serviceName : 'Not enough data yet'}
            </dd>
          </div>
        </dl>
      </Panel>

      {data.profileViews > 0 && data.requests === 0 && (
        <div className="alert alert-warning">
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          People are viewing your profile but not contacting you — consider adding more portfolio photos.
        </div>
      )}
    </main>
  );
}