'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import {
  ApiError,
  getActiveWorkspaceId,
  setActiveWorkspace,
  workspacesApi,
  type WorkspaceMember,
  type WorkspaceMemberRole,
} from '@/lib/api';
import { Panel } from '@/components/ui/page';

interface AssignedMember {
  id: string;
  userId: string;
  role: WorkspaceMemberRole;
  user: { firstName: string; lastName: string; email: string };
}

export function WorkspaceAssignment({
  resource,
  resourceId,
  providerId,
  assignedMembershipId,
  assignedMembership,
  onAssigned,
}: {
  resource: 'request' | 'booking';
  resourceId: string;
  providerId?: string | null;
  assignedMembershipId?: string | null;
  assignedMembership?: AssignedMember | null;
  onAssigned?: () => void;
}) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceMemberRole | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [value, setValue] = useState(assignedMembershipId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(assignedMembershipId ?? '');
  }, [assignedMembershipId]);

  useEffect(() => {
    let cancelled = false;
    const storedId = getActiveWorkspaceId();

    workspacesApi
      .listMine()
      .then((memberships) => {
        if (cancelled) return;
        const matching = providerId
          ? memberships.find((m) => m.status === 'ACTIVE' && m.workspace.provider?.id === providerId)
          : undefined;
        if (providerId && !matching) return;
        const active =
          matching ??
          memberships.find((m) => m.workspace.id === storedId && m.status === 'ACTIVE') ??
          memberships.find((m) => m.status === 'ACTIVE');
        if (!active) return;
        setActiveWorkspace(active.workspace.id, active.role);
        setWorkspaceId(active.workspace.id);
        setRole(active.role);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const canManage = role === 'OWNER' || role === 'MANAGER';

  useEffect(() => {
    if (!workspaceId || !canManage) return;
    let cancelled = false;
    workspacesApi
      .listMembers(workspaceId)
      .then((rows) => {
        if (!cancelled) setMembers(rows.filter((m) => m.status === 'ACTIVE'));
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, canManage]);

  async function assign(membershipId: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      if (resource === 'request') {
        await workspacesApi.assignRequest(workspaceId, resourceId, membershipId || null);
      } else {
        await workspacesApi.assignBooking(workspaceId, resourceId, membershipId || null);
      }
      setValue(membershipId);
      onAssigned?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the assignment');
    } finally {
      setBusy(false);
    }
  }

  if (role === 'MEMBER' && assignedMembership) {
    return (
      <Panel title="Assigned to" className="mb-8">
        <p className="text-sm text-ink-700">
          {assignedMembership.user.firstName} {assignedMembership.user.lastName}{' '}
          <span className="text-ink-400">({assignedMembership.user.email})</span>
        </p>
      </Panel>
    );
  }

  if (!canManage || !workspaceId) return null;

  return (
    <Panel
      title="Assigned to"
      description="Route this work to one active member. Members only see requests and bookings assigned to them."
      className="mb-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
          <Users className="h-4 w-4" aria-hidden="true" />
        </span>
        <select
          aria-label="Assigned workspace member"
          value={value}
          disabled={busy || !members}
          onChange={(e) => void assign(e.target.value)}
          className="sm:max-w-sm"
        >
          <option value="">Unassigned</option>
          {(members ?? []).map((member) => (
            <option key={member.id} value={member.id}>
              {member.user.firstName} {member.user.lastName} ({member.role.toLowerCase()})
            </option>
          ))}
        </select>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-400" aria-label="Saving" />}
      </div>
      {error && (
        <p className="error-text mt-3" role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}
