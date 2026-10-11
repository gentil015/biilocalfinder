'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2, Mail, Users } from 'lucide-react';
import { workspacesApi, type WorkspaceMembershipSummary } from '@/lib/api';
import { WORKSPACE_TYPE_LABEL } from '@/lib/workspace-nav';
import { EmptyState, PageHeader, Panel, Skeleton } from '@/components/ui/page';

// spec §1: a logged-in provider always lands in a workspace, never an
// empty shell. With today's 1:1 provider/workspace backend (see
// docs/WORKSPACES.md), this is a list of one active workspace at most —
// but written against the real "pick the first active workspace, offer
// pending invites, or send them to onboarding" logic, so it keeps working
// once a user can hold several.
export default function DashboardEntryPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<WorkspaceMembershipSummary[] | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workspacesApi
      .listMine()
      .then((list) => {
        const firstActive = list.find((m) => m.status === 'ACTIVE');
        if (firstActive) {
          router.replace(`/dashboard/${firstActive.workspace.id}`);
          return;
        }
        setMemberships(list);
      })
      .catch(() => {
        // Only an unauthenticated call fails here — /dashboard/layout.tsx has
        // already sent clients home, so a signed-in provider reaching an
        // empty list genuinely belongs in onboarding.
        setError('Could not load your workspaces. Please try again.');
      });
  }, [router]);

  async function accept(m: WorkspaceMembershipSummary) {
    setAccepting(m.membershipId);
    try {
      await workspacesApi.acceptInvite(m.workspace.id, m.membershipId);
      router.replace(`/dashboard/${m.workspace.id}`);
    } finally {
      setAccepting(null);
    }
  }

  // Redirect from an effect, not during render. Doing router.replace() in the
  // render body is a React anti-pattern and logged a setState-during-render
  // warning on every attempt. This has to sit *above* every early return
  // below: a useEffect that only runs on some renders changes the hook
  // count between them, which React rejects outright ("Rendered more hooks
  // than during the previous render") — and the first render is always the
  // `memberships === null` loading one, so this fired on every visit.
  useEffect(() => {
    if (!memberships) return;
    if (memberships.length === 0) router.replace('/provider/onboarding');
  }, [memberships, router]);

  if (memberships === null) {
    return (
      <main className="page-workspace py-10">
        <Skeleton className="h-7 w-52" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-workspace py-10">
        <EmptyState icon={AlertCircle} title="Could not load your workspaces" body={error} />
      </main>
    );
  }

  const pending = memberships.filter((m) => m.status === 'INVITED');

  if (memberships.length === 0) {
    return (
      <main className="page-workspace py-10">
        <EmptyState
          icon={Users}
          title="No workspaces yet"
          body="Finish onboarding to create your first workspace."
        />
      </main>
    );
  }

  return (
    <main className="page-workspace py-8">
      <PageHeader
        eyebrow="Workspaces"
        title="Pending invitations"
        description="Accept an invitation to get access to the workspace's dashboard."
      />

      <Panel bodyClassName="p-4 sm:p-5">
        <ul className="space-y-3">
          {pending.map((m) => (
            <li
              key={m.membershipId}
              className="flex flex-col gap-3 rounded-xl border border-ink-200 p-4 transition hover:border-ink-300 hover:shadow-xs sm:flex-row sm:items-center"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink-950">{m.workspace.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                  <span>{WORKSPACE_TYPE_LABEL[m.workspace.type]}</span>
                  <span aria-hidden="true">·</span>
                  <span>invited as {m.role.toLowerCase()}</span>
                </p>
              </div>

              <button
                type="button"
                disabled={accepting === m.membershipId}
                onClick={() => accept(m)}
                className="btn-primary shrink-0"
              >
                {accepting === m.membershipId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Joining…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Accept
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
