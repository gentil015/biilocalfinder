import { apiRequest } from '../client';
import type {
  ProviderType,
  WorkspaceRole,
  WorkspaceSummary,
} from '@/src/types/api';

export interface WorkspaceMembershipSummary {
  membershipId: string;
  role: WorkspaceRole;
  status: string;
  joinedAt: string;
  workspace: WorkspaceSummary;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: 'MANAGER' | 'MEMBER';
  status?: string;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: string;
  joinedAt?: string | null;
  createdAt?: string;
  invitedEmail?: string | null;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export interface WorkspaceInvitationPreview {
  workspace: { id: string; name: string; type: ProviderType };
  email: string;
  role: 'MANAGER' | 'MEMBER';
  inviterName: string;
  expiresAt: string;
}

export type AssignableWorkspaceRole = 'MANAGER' | 'MEMBER';

function segment(value: string): string {
  return encodeURIComponent(value);
}

export const workspacesApi = {
  list: async () => {
    const rows = await apiRequest<WorkspaceMembershipSummary[]>('/workspaces');
    return rows.map((row) => ({
      ...row.workspace,
      membershipId: row.membershipId,
      role: row.role,
      membershipStatus: row.status,
    }));
  },
  get: (workspaceId: string) => apiRequest<WorkspaceSummary>(`/workspaces/${segment(workspaceId)}`),
  create: (dto: { name: string; type: ProviderType }) =>
    apiRequest<WorkspaceSummary>('/workspaces', { method: 'POST', body: JSON.stringify(dto) }),
  update: (workspaceId: string, dto: { name: string }) =>
    apiRequest<WorkspaceSummary>(`/workspaces/${segment(workspaceId)}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  invitations: (workspaceId: string) => apiRequest<WorkspaceInvitation[]>(`/workspaces/${segment(workspaceId)}/invitations`),
  invite: (workspaceId: string, dto: { email: string; role: AssignableWorkspaceRole }) =>
    apiRequest<WorkspaceInvitation>(`/workspaces/${segment(workspaceId)}/members`, { method: 'POST', body: JSON.stringify(dto) }),
  revokeInvitation: (workspaceId: string, invitationId: string) =>
    apiRequest<{ success: boolean }>(
      `/workspaces/${segment(workspaceId)}/invitations/${segment(invitationId)}`,
      { method: 'DELETE' },
    ),
  members: (workspaceId: string) =>
    apiRequest<WorkspaceMember[]>(`/workspaces/${segment(workspaceId)}/members`),
  acceptMembership: (workspaceId: string, membershipId: string) =>
    apiRequest<WorkspaceMember>(`/workspaces/${segment(workspaceId)}/members/${segment(membershipId)}/accept`, {
      method: 'POST',
    }),
  previewInvitation: (token: string) =>
    apiRequest<WorkspaceInvitationPreview>(`/workspace-invitations/${segment(token)}`),
  acceptInvitationToken: (token: string) =>
    apiRequest<Record<string, unknown>>(`/workspace-invitations/${segment(token)}/accept`, { method: 'POST' }),
  updateMemberRole: (workspaceId: string, membershipId: string, role: AssignableWorkspaceRole) =>
    apiRequest<WorkspaceMember>(`/workspaces/${segment(workspaceId)}/members/${segment(membershipId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (workspaceId: string, membershipId: string) =>
    apiRequest<WorkspaceMember>(`/workspaces/${segment(workspaceId)}/members/${segment(membershipId)}`, {
      method: 'DELETE',
    }),
  transferOwnership: (workspaceId: string, membershipId: string) =>
    apiRequest<Record<string, unknown>>(`/workspaces/${segment(workspaceId)}/ownership/transfer`, {
      method: 'POST',
      body: JSON.stringify({ membershipId }),
    }),
  assignRequest: (workspaceId: string, requestId: string, membershipId: string | null) =>
    apiRequest<Record<string, unknown>>(
      `/workspaces/${segment(workspaceId)}/assignments/requests/${segment(requestId)}`,
      { method: 'PATCH', body: JSON.stringify({ membershipId }) },
    ),
  assignBooking: (workspaceId: string, bookingId: string, membershipId: string | null) =>
    apiRequest<Record<string, unknown>>(
      `/workspaces/${segment(workspaceId)}/assignments/bookings/${segment(bookingId)}`,
      { method: 'PATCH', body: JSON.stringify({ membershipId }) },
    ),
};
