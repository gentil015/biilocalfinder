'use client';

import { useEffect, useState } from 'react';
import { UserPlus, X, Users, UserCheck, Clock, UserRoundX } from 'lucide-react';
import { ApiError, workspacesApi, type WorkspaceMember } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader, Panel, StatCard, EmptyState, LoadingBlock } from '@/components/ui/page';

// spec §3/§4: "Invite, remove, and manage team members" / "Invite and
// manage staff", with roles enforced — never every member getting owner
// permissions. All of the actual enforcement lives on the backend
// (WorkspaceMembershipGuard + WorkspacesService); this page just can't
// render the controls a MEMBER-role viewer isn't allowed to use.
export default function WorkspaceMembersPage({ params }: { params: { workspaceId: string } }) {
  const { workspaceId } = params;
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MANAGER' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    workspacesApi.listMembers(workspaceId).then(setMembers).catch(() => setMembers([]));
  }, [workspaceId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      const member = await workspacesApi.inviteMember(workspaceId, { email, role });
      setMembers((prev) => (prev ? [...prev, member] : [member]));
      setEmail('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the invite');
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(membershipId: string, newRole: 'MANAGER' | 'MEMBER') {
    setBusyId(membershipId);
    try {
      const updated = await workspacesApi.updateMemberRole(workspaceId, membershipId, newRole);
      setMembers((prev) => prev!.map((m) => (m.id === membershipId ? updated : m)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the role');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(membershipId: string) {
    setBusyId(membershipId);
    try {
      await workspacesApi.removeMember(workspaceId, membershipId);
      setMembers((prev) => prev!.filter((m) => m.id !== membershipId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this member');
    } finally {
      setBusyId(null);
    }
  }

  if (!members) return <LoadingBlock label="Loading your roster…" />;

  const active = members.filter((m) => m.status === 'ACTIVE').length;
  const invited = members.filter((m) => m.status === 'INVITED').length;
  const managers = members.filter((m) => m.role === 'MANAGER' || m.role === 'OWNER').length;

  return (
    <>
      <PageHeader
        eyebrow="Roster"
        title="Members"
        description="People who can access this dashboard. Only owners and managers can invite or remove members; only the owner can change roles."
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

      <Panel title="Invite someone" className="mb-6">
        <form onSubmit={invite} className="space-y-4">
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end">
            <div className="field">
              <label className="label" htmlFor="invite-email">
                Their account email
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
                value={role}
                onChange={(e) => setRole(e.target.value as 'MANAGER' | 'MEMBER')}
              >
                <option value="MEMBER">Member</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
            <button type="submit" disabled={inviting} className="btn-primary">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              {inviting ? 'Inviting…' : 'Invite'}
            </button>
          </div>
          <p className="hint">
            They need a BII LocalFinder account already — ask them to register first if this fails.
          </p>
        </form>
      </Panel>

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
                  <th scope="col" className="w-12 text-right">
                    <span className="sr-only">Remove</span>
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
                      {m.role === 'OWNER' ? (
                        // The owner can't be demoted through this page — the
                        // backend has no transfer-ownership action yet.
                        <span className="badge badge-brand">Owner</span>
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
                      {m.role === 'OWNER' ? (
                        <span className="text-2xs font-medium text-ink-300">—</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Remove ${m.user.firstName} ${m.user.lastName}`}
                          disabled={busyId === m.id}
                          onClick={() => remove(m.id)}
                          className="icon-btn h-8 w-8 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
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
