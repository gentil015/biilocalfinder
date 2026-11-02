'use client';

import { useI18n } from '@/components/locale-provider';
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
import { ProviderProfileNav } from '@/components/provider-profile-nav';

export default function ProviderAnalyticsPage() {
  const { translateMessage: tr } = useI18n();
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
        <LoadingBlock label={tr("Loading analytics…")} />
      </main>
    );

  if (!data)
    return (
      <main className="page-narrow py-6 md:py-8">
        <div className="alert alert-error" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {tr("Couldn't load analytics.")}
        </div>
      </main>
    );

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader eyebrow={tr("Provider")} title={tr("Analytics")} description={data.periodLabel} />

      <ProviderProfileNav className="mb-6" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Eye} label={tr("Profile views")} value={String(data.profileViews)} />
        <StatCard icon={Eye} label={tr("Service views")} value={String(data.serviceViews)} />
        <StatCard icon={MessageSquare} label={tr("Requests")} value={String(data.requests)} />
        <StatCard icon={ShoppingBag} label={tr("Quotes sent")} value={String(data.quotesSent)} />
        <StatCard icon={TrendingUp} label={tr("Bookings")} value={String(data.bookings)} />
        <StatCard icon={Percent} label={tr("Conversion")} value={`${data.conversionRate}%`} />
      </div>

      {data.profileViews === 0 && (
        <Panel
          className="mb-6"
          title={tr("Get your first views")}
          description={tr("Your numbers will fill in as clients find you. These are the quickest ways to get noticed.")}
        >
          <ul className="divide-y divide-ink-100">
            {[
              { href: '/provider/offerings/new', label: 'List a service clients can search for' },
              { href: '/provider/profile', label: 'Add a description and profile photo' },
              { href: '/provider/portfolio', label: 'Upload a few photos of past work' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="group flex items-center gap-2.5 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-700">{tr(item.label)}</span>
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

      <Panel title={tr("Trending services")} description={tr("Which of your services are drawing the most attention.")} className="mb-6">
        <dl className="detail-list">
          <div className="detail-row">
            <dt className="flex items-center gap-2">
              <Search className="h-4 w-4 text-ink-400" aria-hidden="true" />
              <span className="detail-key">{tr("Top searched service")}</span>
            </dt>
            <dd className={`detail-value ${!data.topSearchedService ? 'font-medium text-ink-400' : ''}`}>
              {data.topSearchedService ? data.topSearchedService.serviceName : tr('Not enough data yet')}
            </dd>
          </div>
          <div className="detail-row">
            <dt className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-ink-400" aria-hidden="true" />
              <span className="detail-key">{tr("Most viewed service")}</span>
            </dt>
            <dd className={`detail-value ${!data.mostViewedService ? 'font-medium text-ink-400' : ''}`}>
              {data.mostViewedService ? data.mostViewedService.serviceName : tr('Not enough data yet')}
            </dd>
          </div>
        </dl>
      </Panel>

      {data.profileViews > 0 && data.requests === 0 && (
        <div className="alert alert-warning">
          <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          {tr("People are viewing your profile but not contacting you — consider adding more portfolio photos.")}
        </div>
      )}
    </main>
  );
}