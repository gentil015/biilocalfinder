'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Image as ImageIcon,
  Inbox,
  ListChecks,
  MapPin,
  ShieldCheck,
  Star,
  TrendingUp,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { providerInsightsApi, providerOnboardingApi } from '@/lib/api';
import { onboardingStepPath } from '@/lib/onboarding';
import { PageHeader, Panel, LoadingBlock } from '@/components/ui/page';

interface ProviderInsights {
  recommendedActions: { action: string; label: string }[];
  opportunities: { serviceId: string; serviceName: string; categoryName: string; approximateInterestedUsers: number }[];
  profileStrength: { percent: number; checklist: { id: string; label: string; checked: boolean }[] };
}

const QUICK_LINKS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: '/provider/profile', label: 'Your profile', hint: 'Edit what clients see', icon: UserCog },
  { href: '/provider/requests', label: 'Incoming requests', hint: 'Quote work that matches your services', icon: Inbox },
  { href: '/bookings', label: 'Bookings', hint: 'Scheduled, active and completed work', icon: CalendarClock },
  { href: '/provider/portfolio', label: 'Portfolio', hint: 'Show clients your work', icon: ImageIcon },
  { href: '/provider/analytics', label: 'Analytics', hint: "This month's numbers", icon: BarChart3 },
  { href: '/provider/verification', label: 'Trust', hint: 'Get verified', icon: ShieldCheck },
  { href: '/provider/reviews', label: 'Reviews', hint: 'Respond to clients', icon: Star },
  { href: '/provider/availability', label: 'Schedule', hint: 'Set your hours', icon: Clock },
  { href: '/provider/service-areas', label: 'Coverage', hint: 'Where you work', icon: MapPin },
];

// Profile strength ring — a plain SVG progress ring, no chart library.
// Each incomplete profile-strength item links to the page that actually fixes
// it — the checklist used to be inert text, so a provider told "add a
// business description" had no way to act on it.
const CHECKLIST_HREF: Record<string, string> = {
  DESCRIPTION: '/provider/profile#description',
  PHONE_VERIFIED: '/provider/verification',
  LOCATION: '/provider/service-areas',
  SERVICES: '/provider/offerings',
  PORTFOLIO: '/provider/portfolio',
  AVAILABILITY: '/provider/availability',
  PRICING: '/provider/offerings',
};

function StrengthRing({ percent }: { percent: number }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      className="shrink-0"
      role="img"
      aria-label={`Profile strength ${percent}%`}
    >
      <circle cx="36" cy="36" r={radius} fill="none" stroke="rgb(var(--ink-200))" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="none"
        stroke="rgb(var(--brand-600))"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="41" textAnchor="middle" className="fill-ink-900 text-sm font-bold" aria-hidden="true">
        {percent}%
      </text>
    </svg>
  );
}

export default function ProviderDashboardPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<ProviderInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Resume onboarding automatically if it isn't finished yet — a provider
  // shouldn't be able to land on the dashboard mid-setup and wonder why
  // nothing works (spec: "Persist onboarding progress so users can leave
  // and resume later").
  useEffect(() => {
    providerOnboardingApi
      .getState()
      .then((state) => {
        if (state.onboardingStep !== 'COMPLETED') {
          router.replace(onboardingStepPath(state.onboardingStep));
          return;
        }
        setCheckingOnboarding(false);
      })
      .catch(() => setCheckingOnboarding(false));
  }, [router]);

  useEffect(() => {
    if (checkingOnboarding) return;
    providerInsightsApi
      .get()
      .then(setInsights)
      .catch(() => setInsights(null))
      .finally(() => setLoading(false));
  }, [checkingOnboarding]);

  if (checkingOnboarding) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your dashboard…" />
      </main>
    );
  }

  const hasActions = !!insights?.recommendedActions?.length;
  const hasOpportunities = !!insights?.opportunities?.length;

  return (
    <main className="page-narrow py-6 md:py-8">
      <PageHeader
        eyebrow="Provider"
        title="Business overview"
        description="Quick links and opportunities based on marketplace-wide activity — never any individual client's private searches or messages."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="surface-card-interactive group flex flex-col gap-3 p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500 transition group-hover:bg-brand-50 group-hover:text-brand-600">
              <link.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink-950 group-hover:text-brand-700">
                {link.label}
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">{link.hint}</span>
            </span>
          </Link>
        ))}
      </div>

      {loading && <LoadingBlock label="Loading insights…" />}

      {!loading && insights?.profileStrength && (
        <Panel
          className="mb-6"
          title="Profile strength"
          description="Complete your profile to rank higher in search and win more clients."
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
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <StrengthRing percent={insights.profileStrength.percent} />
            <ul className="flex-1 space-y-2">
              {insights.profileStrength.checklist.map((item) => {
                const href = CHECKLIST_HREF[item.id];
                const label = (
                  <span className={item.checked ? 'text-ink-500' : 'font-medium text-ink-800'}>
                    {item.label}
                  </span>
                );
                return (
                  <li key={item.id} className="flex items-center gap-2.5 text-sm">
                    {item.checked ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" aria-hidden="true" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
                    )}
                    {/* Completed items stay plain text — there is nothing left to do. */}
                    {item.checked || !href ? (
                      label
                    ) : (
                      <Link href={href} className="group flex items-center gap-1 hover:underline">
                        {label}
                        <ChevronRight
                          className="h-3.5 w-3.5 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                          aria-hidden="true"
                        />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>
      )}

      {!loading && hasActions && (
        <Panel className="mb-6" title="Recommended next steps">
          <ul className="space-y-2">
            {insights!.recommendedActions.map((a) => (
              <li key={a.action} className="flex items-center gap-2.5 text-sm text-ink-700">
                <ListChecks className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                {a.label}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!loading && hasOpportunities && (
        <Panel
          className="mb-6"
          title="Opportunities near you"
          description="Services with demand in your area that you don't cover yet."
        >
          <ul className="divide-y divide-ink-100">
            {insights!.opportunities.map((o) => (
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

      {!loading && !hasActions && !hasOpportunities && (
        <div className="surface-panel px-4 py-3 text-sm text-ink-600">
          <span className="mr-1.5 inline-flex h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />
          Your profile looks complete — check back later for new opportunities.
        </div>
      )}
    </main>
  );
}