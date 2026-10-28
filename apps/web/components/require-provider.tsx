'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workspacesApi } from '@/lib/api';
import { useSession } from '@/components/auth-provider';

/**
 * Client-side gate for the workspace surfaces (/dashboard/**, /provider/**).
 *
 * The API is still the authority: every workspace route is behind a JWT guard
 * plus workspace membership/permission checks. This guard exists so a user
 * without any workspace sees an honest redirect instead of a shell that 403s
 * on every request.
 *
 * Membership, not the platform account role, decides access. An invited
 * teammate can legitimately hold a CLIENT account while belonging to a
 * provider workspace, so a CLIENT is allowed through when listMine returns an
 * active or pending membership.
 */
export function RequireProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useSession();
  const [hasWorkspace, setHasWorkspace] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin');
      return;
    }
    if (user.role === 'PROVIDER') {
      setHasWorkspace(true);
      return;
    }

    let cancelled = false;
    workspacesApi
      .listMine()
      .then((memberships) => {
        if (cancelled) return;
        const allowed = memberships.some((m) => m.status === 'ACTIVE' || m.status === 'INVITED');
        if (!allowed) {
          router.replace('/');
          return;
        }
        setHasWorkspace(true);
      })
      .catch(() => {
        if (!cancelled) router.replace('/');
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  if (loading || !user || (user.role !== 'PROVIDER' && user.role !== 'ADMIN' && hasWorkspace !== true)) {
    return (
      <main className="page-narrow py-10 text-sm text-ink-400">
        Checking your access…
      </main>
    );
  }

  if (user.role === 'ADMIN') {
    return (
      <main className="page-narrow py-10 text-sm text-ink-400">
        Redirecting…
      </main>
    );
  }

  return <>{children}</>;
}
