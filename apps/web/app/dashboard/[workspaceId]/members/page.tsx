'use client';

import { useEffect, useState } from 'react';
import { UserPlus, X, Users, UserCheck, Clock, UserRoundX, Mail } from 'lucide-react';
import {
  ApiError,
  workspacesApi,
  type WorkspaceInvitation,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

export default function WorkspaceMembersPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [role, setRole] = useState<WorkspaceMemberRole>('MEMBER');
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MANAGER' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = role === 'OWNER' || role === 'MANAGER';
  const isOwner = role === 'OWNER';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const memberships = await workspacesApi.listMine();
      const active = memberships.find((m) => m.workspace.id === workspaceId);
      const nextRole = active?.role ?? 'MEMBER';
      const [memberList, invitationList] = await Promise.all([
        workspacesApi.listMembers(workspaceId),
        nextRole === 'MEMBER'
          ? Promise.resolve([] as WorkspaceInvitation[])
          : workspacesApi.listInvitations(workspaceId).catch(() => [] as WorkspaceInvitation[]),
      ]);
      if (cancelled) return;
      setRole(nextRole);
      setMembers(memberList);
      setInvitations(invitationList);
    }

    load().catch(() => {
      if (!cancelled) setMembers([]);
    });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function reloadLists() {
    const [memberList, invitationList] = await Promise.all([
      workspacesApi.listMembers(workspaceId),
      canManage
        ? workspacesApi.listInvitations(workspaceId).catch(() => [] as WorkspaceInvitation[])
        : Promise.resolve([] as WorkspaceInvitation[]),
    ]);
    setMembers(memberList);
    setInvitations(invitationList);
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await workspacesApi.inviteMember(workspaceId, { email, role: inviteRole });
      setEmail('');
      await reloadLists();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite');
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(membershipId: string, newRole: 'MANAGER' | 'MEMBER') {
    setBusyId(membershipId);
    setError(null);
    try {
      const updated = await workspacesApi.updateMemberRole(workspaceId, membershipId, newRole);
      setMembers((prev) => prev!.map((m) => (m.id === membershipId ? { ...m, role: updated.role } : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the role');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(membershipId: string) {
    setBusyId(membershipId);
    setError(null);
    try {
      await workspacesApi.removeMember(workspaceId, membershipId);
      setMembers((prev) => prev!.filter((m) => m.id !== membershipId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this member');
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setBusyId(invitationId);
    setError(null);
    try {
      await workspacesApi.revokeInvitation(workspaceId, invitationId);
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not revoke this invitation');
    } finally {
      setBusyId(null);
    }
  }

  async function transfer(membershipId: string, name: string) {
    if (!window.confirm(`Make ${name} the owner? You will become a manager and lose owner-only controls.`)) return;
    setBusyId(membershipId);
    setError(null);
    try {
      await workspacesApi.transferOwnership(workspaceId, membershipId);
      setMembers((prev) =>
        prev!.map((m) =>
          m.id === membershipId
            ? { ...m, role: 'OWNER' }
            : m.role === 'OWNER'
              ? { ...m, role: 'MANAGER' }
              : m,
        ),
      );
      setRole('MANAGER');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not transfer ownership');
    } finally {
      setBusyId(null);
    }
  }

  if (!members) return <LoadingBlock label="Loading your roster…" />;

  const memberEmails = new Set(
    members.filter((m) => m.status === 'INVITED').map((m) => (m.invitedEmail ?? m.user.email).toLowerCase()),
  );
  const pendingEmailInvites = invitations.filter((i) => !memberEmails.has(i.email.toLowerCase()));
  const active = members.filter((m) => m.status === 'ACTIVE').length;
  const invited = members.filter((m) => m.status === 'INVITED').length + pendingEmailInvites.length;
  const managers = members.filter((m) => m.role === 'MANAGER' || m.role === 'OWNER').length;

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        title="Members"
        description="People who can access this dashboard. Owners and managers can invite or remove members; only the owner can change roles or transfer ownership."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="On the roster" value={String(members.length)} sub="Everyone with access" />
        <StatCard icon={UserCheck} label="Active" tone="success" value={String(active)} sub="Can sign in now" />
        <StatCard
          icon={Clock}
          label="Invited"
          tone={invited > 0 ? 'warning' : 'neutral'}
          value={String(invited)}
          sub="Haven't accepted yet"
        />
        <StatCard icon={UserRoundX} label="Can manage" value={String(managers)} sub="Owners and managers" />
      </div>

      {error && (
        <p className="error-text mb-4" role="alert">
          {error}
        </p>
      )}

      {canManage && (
        <Panel title="Invite someone" className="mb-6">
          <form onSubmit={invite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
              <div className="field">
                <label className="label" htmlFor="invite-email">
                  Their email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'MANAGER' | 'MEMBER')}
                >
                  <option value="MEMBER">Member</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <button type="submit" disabled={inviting} className="btn-primary">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {inviting ? 'Inviting…' : 'Send invite'}
              </button>
            </div>
            <p className="hint">
              They&rsquo;ll get an email with a secure link. If they don&rsquo;t have an account yet, they can
              create one with this email address and the invite will still work.
            </p>
          </form>
        </Panel>
      )}

      {canManage && pendingEmailInvites.length > 0 && (
        <Panel title="Pending email invitations" className="mb-6" bodyClassName="p-0">
          <ul className="divide-y divide-ink-100">
            {pendingEmailInvites.map((invitation) => (
              <li key={invitation.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-950">{invitation.email}</p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Invited as {invitation.role.toLowerCase()} · expires{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === invitation.id}
                  onClick={() => void revokeInvitation(invitation.id)}
                  className="btn-secondary btn-sm shrink-0"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody else here yet"
          body="Invite a manager to look after bookings and quotes while you stay off the tools."
        />
      ) : (
        <Panel title="Roster" bodyClassName="p-0">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col" className="w-40">
                    Role
                  </th>
                  <th scope="col" className="w-28">
                    Status
                  </th>
                  <th scope="col" className="w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="max-w-[20rem]">
                      <p className="truncate text-sm font-semibold text-ink-950">
                        {m.user.firstName} {m.user.lastName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">{m.user.email}</p>
                    </td>
                    <td>
                      {m.role === 'OWNER' || !isOwner ? (
                        <span className={`badge ${m.role === 'OWNER' ? 'badge-brand' : 'badge-neutral'}`}>
                          {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                        </span>
                      ) : (
                        <select
                          value={m.role}
                          disabled={busyId === m.id}
                          onChange={(e) => changeRole(m.id, e.target.value as 'MANAGER' | 'MEMBER')}
                          aria-label={`Role for ${m.user.firstName} ${m.user.lastName}`}
                          className="h-8 py-0 text-xs"
                        >
                          <option value="MEMBER">Member</option>
                          <option value="MANAGER">Manager</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isOwner && m.status === 'ACTIVE' && m.role !== 'OWNER' && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            onClick={() => void transfer(m.id, `${m.user.firstName} ${m.user.lastName}`.trim())}
                            className="btn-secondary btn-sm whitespace-nowrap"
                          >
                            Make owner
                          </button>
                        )}
                        {canManage && m.role !== 'OWNER' ? (
                          <button
                            type="button"
                            aria-label={`Remove ${m.user.firstName} ${m.user.lastName}`}
                            disabled={busyId === m.id}
                            onClick={() => remove(m.id)}
                            className="icon-btn h-8 w-8 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="text-2xs font-medium text-ink-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
