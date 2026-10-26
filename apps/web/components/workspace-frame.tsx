'use client';

import type { Workspace, WorkspaceMembershipSummary } from '@/lib/api';
import { WORKSPACE_NAV, WORKSPACE_TYPE_LABEL } from '@/lib/workspace-nav';
import { WorkspaceShell, WorkspaceSwitcher } from '@/components/workspace-switcher';
import { VerificationBadge } from '@/components/verification-badge';

/**
 * The shared dashboard foundation (spec §6): one shell, type-specific nav
 * swapped in underneath it — never four separate apps. Both the
 * /dashboard/[workspaceId] routes and the /provider routes render inside this
 * so the sidebar stays put when a provider moves between them.
 */
export function WorkspaceFrame({
  workspace,
  memberships,
  overviewHref,
  children,
}: {
  workspace: Workspace;
  memberships: WorkspaceMembershipSummary[];
  /** Where "Overview" points — defaults to this workspace's dashboard. */
  overviewHref?: string;
  children: React.ReactNode;
}) {
  const navItems = WORKSPACE_NAV[workspace.type];

  return (
    <WorkspaceShell
      navLabel={`${WORKSPACE_TYPE_LABEL[workspace.type]} dashboard navigation`}
      nav={navItems.map((item) => ({
        label: item.label,
        href: item.label === 'Overview' && overviewHref ? overviewHref : item.href(workspace.id),
        icon: item.icon,
      }))}
      identity={
        <div className="flex min-w-0 items-center gap-2.5">
          <WorkspaceSwitcher memberships={memberships} activeWorkspaceId={workspace.id} />
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
