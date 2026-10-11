'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Building, User, Users } from 'lucide-react';
import { ApiError, ProviderType, providerOnboardingApi } from '@/lib/api';
import { onboardingStepPath } from '@/lib/onboarding';
import { ProviderTypeCard } from '@/components/provider-type-card';
import { LoadingBlock } from '@/components/ui/page';

const OPTIONS: { type: ProviderType; icon: typeof User; title: string; description: string; examples: string }[] = [
  {
    type: 'INDIVIDUAL',
    icon: User,
    title: 'Individual',
    description: 'I work alone and provide services directly to clients.',
    examples: 'Plumber, cleaner, electrician, freelancer, photographer',
  },
  {
    type: 'TEAM',
    icon: Users,
    title: 'Team or group',
    description: 'We are a group of people working together to provide services.',
    examples: 'Cleaning team, construction team, event decorators',
  },
  {
    type: 'BUSINESS',
    icon: Building,
    title: 'Registered business',
    description: 'We operate as a registered company or business.',
    examples: 'Cleaning company, construction company, transport company',
  },
  {
    type: 'AGENCY',
    icon: Briefcase,
    title: 'Agency',
    description: 'We connect clients with multiple service providers or manage workers on their behalf.',
    examples: 'Recruitment agency, home-service agency, event staffing agency',
  },
];

export default function ProviderTypeSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ProviderType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume: prefill whatever was previously chosen, so navigating back
  // here (browser back, or an explicit "change type" link later) never
  // loses the selection (spec: "Preserve the selection when navigating
  // backward").
  useEffect(() => {
    providerOnboardingApi
      .getState()
      .then((state) => setSelected(state.providerType))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        // Any other error (e.g. transient network issue) — let them try
        // selecting anyway rather than dead-ending on a blank page.
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onContinue() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const provider = await providerOnboardingApi.selectType(selected);
      router.push(onboardingStepPath(provider.onboardingStep));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your selection. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Loading your onboarding…" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <div className="mb-2 flex items-center gap-1.5" aria-hidden="true">
        {['bg-brand-600', 'bg-ink-200', 'bg-ink-200'].map((c, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${c}`} />
        ))}
      </div>
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">Step 1 of 3</p>

      <h1 className="mb-1 font-display text-2xl font-semibold text-ink-950">How will you provide services?</h1>
      <p className="mb-6 text-sm text-ink-500">Choose the option that best describes you or your team.</p>

      <div className="flex flex-1 flex-col gap-3">
        {OPTIONS.map((o) => (
          <ProviderTypeCard
            key={o.type}
            icon={o.icon}
            title={o.title}
            description={o.description}
            examples={o.examples}
            selected={selected === o.type}
            onSelect={() => setSelected(o.type)}
          />
        ))}
      </div>

      {error && (
        <p className="error-text mt-4" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={onContinue}
        disabled={!selected || saving}
        className="btn-primary btn-lg mt-6 w-full"
      >
        {saving ? 'Saving…' : 'Continue'}
      </button>
    </main>
  );
}