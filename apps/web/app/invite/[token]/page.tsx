'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, MailWarning, Users } from 'lucide-react';
import {
  ApiError,
  setActiveWorkspace,
  workspacesApi,
  type WorkspaceInvitationPreview,
} from '@/lib/api';
import { useSession } from '@/components/auth-provider';
import { PageHeader, Panel, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: sessionLoading } = useSession();
  const [invitation, setInvitation] = useState<WorkspaceInvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workspacesApi
      .getInvitation(token)
      .then((preview) => {
        if (!cancelled) setInvitation(preview);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'This invitation is invalid or has expired');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function accept() {
    if (!user) return;
    setAccepting(true);
    setError(null);
    try {
      const context = await workspacesApi.acceptInvitation(token);
      const membership = context.memberships.find((m) => m.userId === user.id);
      setActiveWorkspace(context.id, membership?.role);
      router.replace(`/dashboard/${context.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept this invitation');
    } finally {
      setAccepting(false);
    }
  }

  if (error && !invitation) {
    return (
      <main className="page-narrow py-16">
        <EmptyState icon={MailWarning} title="Invitation unavailable" body={error} />
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="page-narrow py-10">
        <LoadingBlock label="Checking your invitation…" />
      </main>
    );
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const registerHref = `/register?next=${encodeURIComponent(pathname)}`;
  const wrongAccount = !!user && user.email.toLowerCase() !== invitation.email.toLowerCase();

  return (
    <main className="page-narrow py-10">
      <PageHeader
        eyebrow="Workspace invitation"
        title={invitation.workspace.name}
        description={`${invitation.inviterName || 'A workspace owner'} invited you to join as ${
          invitation.role.charAt(0) + invitation.role.slice(1).toLowerCase()
        }.`}
      />

      <Panel>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-950">Invitation for {invitation.email}</p>
            <p className="mt-1 text-sm text-ink-500">
              Expires {new Date(invitation.expiresAt).toLocaleString()}.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mt-5 py-3" role="alert">
            {error}
          </div>
        )}

        {sessionLoading ? (
          <p className="mt-6 text-sm text-ink-400">Checking your account…</p>
        ) : !user ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href={loginHref} className="btn-primary">
              Sign in to accept
            </Link>
            <Link href={registerHref} className="btn-secondary">
              Create an account
            </Link>
          </div>
        ) : wrongAccount ? (
          <div className="mt-6">
            <div className="alert alert-warning py-3" role="alert">
              You are signed in as {user.email}. Sign in with {invitation.email} to accept this invitation.
            </div>
            <Link href={loginHref} className="btn-secondary mt-4">
              Use a different account
            </Link>
          </div>
        ) : (
          <button type="button" onClick={() => void accept()} disabled={accepting} className="btn-primary mt-6">
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Joining…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Accept invitation
              </>
            )}
          </button>
        )}
      </Panel>
    </main>
  );
}
