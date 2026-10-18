'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { providerOnboardingApi, workspacesApi, type Workspace, type WorkspaceMembershipSummary } from '@/lib/api';
import { onboardingStepPath } from '@/lib/onboarding';
import { WORKSPACE_NAV, WORKSPACE_TYPE_LABEL } from '@/lib/workspace-nav';
import { WorkspaceShell, WorkspaceSwitcher } from '@/components/workspace-switcher';
import { VerificationBadge } from '@/components/verification-badge';
import { LoadingBlock } from '@/components/ui/page';

// The shared dashboard foundation (spec §6): one shell, type-specific nav
// swapped in underneath it — never four separate apps. Every workspace
// page under /dashboard/[workspaceId] renders inside this.
export default function WorkspaceDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const { workspaceId } = params;
  const router = useRouter();
  const [memberships, setMemberships] = useState<WorkspaceMembershipSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 'checking' → 'complete' once the active workspace's owner has finished
  // onboarding; a provider mid-setup is bounced to the right step of the
  // wizard before any dashboard surface renders (same rule as
  // /provider/dashboard) — a workspace whose owner never finished setup
  // would otherwise let the provider browse half-broken pages forever.
  const [onboardingCheck, setOnboardingCheck] = useState<'checking' | 'complete'>('checking');

  useEffect(() => {
    setError(null);
    workspacesApi
      .listMine()
      .then(setMemberships)
      .catch(() => setError("Couldn't load your workspaces"));
  }, [workspaceId]);

  // Gate the whole workspace on completion of onboarding. The provider row is
  // the single source of truth (the workspace's own onboardingStep is a
  // mirrored copy), so this reads the same endpoint the wizard itself uses.
  // Non-provider members (MANAGER/MEMBER) have no provider row of their own —
  // getState() throws for them and the catch lets them through.
  useEffect(() => {
    if (!memberships) return;
    const active = memberships.find((m) => m.workspace.id === workspaceId && m.status === 'ACTIVE');
    if (!active) {
      setOnboardingCheck('complete');
      return;
    }
    providerOnboardingApi
      .getState()
      .then((state) => {
        if (state.onboardingStep !== 'COMPLETED') {
          router.replace(onboardingStepPath(state.onboardingStep));
          return;
        }
        setOnboardingCheck('complete');
      })
      .catch(() => setOnboardingCheck('complete'));
  }, [memberships, workspaceId, router]);

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
        <LoadingBlock label="Loading your workspaces…" />
      </main>
    );
  }

  if (onboardingCheck !== 'complete') {
    return (
      <main className="page-narrow py-10">
        <LoadingBlock label="Checking your setup progress…" />
      </main>
    );
  }

  const active = memberships.find((m) => m.workspace.id === workspaceId && m.status === 'ACTIVE');

  if (!active) {
    // Not an ACTIVE member of this workspace (or it doesn't exist, or
    // their invite is still pending) — never trust the URL; the backend
    // re-checks this on every API call regardless
    // (WorkspaceMembershipGuard), this just avoids rendering a dead shell.
    const firstActive = memberships.find((m) => m.status === 'ACTIVE');
    return (
      <main className="page-narrow py-16">
        <div className="empty-state">
          <p className="text-sm font-bold text-ink-900">You don&rsquo;t have access to that workspace</p>
          <p className="mt-1.5 text-sm text-ink-500">
            You may not be an active member, or the invite is still pending.
          </p>
          {firstActive && (
            <button
              type="button"
              className="btn-primary btn-sm mt-5"
              onClick={() => router.replace(`/dashboard/${firstActive.workspace.id}`)}
            >
              Go to {firstActive.workspace.name}
            </button>
          )}
        </div>
      </main>
    );
  }

  const workspace: Workspace = active.workspace;
  const navItems = WORKSPACE_NAV[workspace.type];

  return (
    <WorkspaceShell
      navLabel={`${WORKSPACE_TYPE_LABEL[workspace.type]} dashboard navigation`}
      nav={navItems.map((item) => ({ label: item.label, href: item.href(workspaceId), icon: item.icon }))}
      identity={
        <div className="flex min-w-0 items-center gap-2.5">
          <WorkspaceSwitcher
            memberships={memberships}
            activeWorkspaceId={workspaceId}
          />
        </div>
      }
    >
      {workspace.provider && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-surface px-4 py-3">
          <VerificationBadge status={workspace.provider.verificationStatus} />
          <p className="text-sm text-ink-600">
            {workspace.provider.verificationStatus === 'VERIFIED'
              ? 'Your profile is verified — you appear with a trust badge in search.'
              : 'Complete verification to appear with a trust badge in search.'}
          </p>
        </div>
      )}
      {children}
    </WorkspaceShell>
  );
}
