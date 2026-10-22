'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, ProviderOnboardingState, providerOnboardingApi } from '@/lib/api';
import { LoadingBlock } from '@/components/ui/page';

export default function ProviderOnboardingServicesPage() {
  const router = useRouter();
  const [state, setState] = useState<ProviderOnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    providerOnboardingApi
      .getState()
      .then((s) => {
        if (!s.providerType) {
          router.replace('/provider/onboarding');
          return;
        }
        setState(s);
        // Skip to creating first service
        router.replace('/provider/offerings/new?onboarding=1');
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !state) {
    return (
      <main className="page-narrow py-6 md:py-8">
        <LoadingBlock label="Redirecting to create your service…" />
      </main>
    );
  }

  return null;
}
