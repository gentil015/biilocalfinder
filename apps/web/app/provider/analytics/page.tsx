'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Eye,
  MessageSquare,
  Percent,
  Search,
  ShoppingBag,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
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

      {data.profileViews === 0 && (
        <Panel
          className="mb-6"
          title="Get your first views"
          description="Your numbers will fill in as clients find you. These are the quickest ways to get noticed."
        >
          <ul className="divide-y divide-ink-100">
            {[
              { href: '/provider/offerings/new', label: 'List a service clients can search for' },
              { href: '/provider/profile', label: 'Add a description and profile photo' },
              { href: '/provider/portfolio', label: 'Upload a few photos of past work' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-center gap-2.5 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-700">{item.label}</span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

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