'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { workspacesApi, type WorkspaceMembershipSummary } from '@/lib/api';
import { RequireProvider } from '@/components/require-provider';
import { WorkspaceFrame } from '@/components/workspace-frame';
import { LoadingBlock } from '@/components/ui/page';

// The provider-era surfaces (/provider/*) predate the workspace dashboard
// shell, so they rendered without it — a provider who opened Profile,
// Requests or Billing from the sidebar landed on a page with marketplace
// chrome and no way back except the browser. Keep the same sidebar and
// workspace identity on every provider page, exactly as the billing page
// under /dashboard/[workspaceId] does. Messages stay a marketplace route, so
// it is intentionally not covered here.
export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOnboarding = pathname.startsWith('/provider/onboarding');

  // The onboarding wizard is a focused, full-screen flow — it must not show
  // the dashboard sidebar before the workspace exists.
  if (isOnboarding) {
    return <RequireProvider>{children}</RequireProvider>;
  }

  return (
    <RequireProvider>
      <ProviderWorkspaceShell>{children}</ProviderWorkspaceShell>
    </RequireProvider>
  );
}

function ProviderWorkspaceShell({ children }: { children: React.ReactNode }) {
  const [memberships, setMemberships] = useState<WorkspaceMembershipSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspacesApi
      .listMine()
      .then(setMemberships)
      .catch(() => setError("Couldn't load your workspace"));
  }, []);

  if (error) {
    return (
      <main className="page-narrow py-10">
        <div className="alert alert-error">{error}</div>
      </main>
    );
  }

  if (!memberships) {
    return (
      <main className="page-narrow py-10">
        <LoadingBlock label="Loading your workspace…" />
      </main>
    );
  }

  const active =
    memberships.find((m) => m.status === 'ACTIVE' && m.workspace.provider) ??
    memberships.find((m) => m.status === 'ACTIVE');

  if (!active) {
    return (
      <main className="page-narrow py-16">
        <div className="empty-state">
          <p className="text-sm font-bold text-ink-900">You don&rsquo;t have an active workspace</p>
          <p className="mt-1.5 text-sm text-ink-500">
            Finish setting up your provider workspace to open your dashboard.
          </p>
          <Link href="/provider/onboarding" className="btn-primary btn-sm mt-5">
            Continue setup
          </Link>
        </div>
      </main>
    );
  }

  return (
    <WorkspaceFrame
      workspace={active.workspace}
      memberships={memberships}
      overviewHref="/provider/dashboard"
    >
      {children}
    </WorkspaceFrame>
  );
}
