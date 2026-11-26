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

export const workspacesApi = {
  list: async () => {
    const rows = await apiRequest<WorkspaceMembershipSummary[]>('/workspaces');
    return rows.map((row) => ({
      ...row.workspace,
      role: row.role,
      membershipStatus: row.status,
    }));
  },
  get: (workspaceId: string) => apiRequest<WorkspaceSummary>(`/workspaces/${workspaceId}`),
  create: (dto: { name: string; type: ProviderType }) =>
    apiRequest<WorkspaceSummary>('/workspaces', { method: 'POST', body: JSON.stringify(dto) }),
  update: (workspaceId: string, dto: { name: string }) =>
    apiRequest<WorkspaceSummary>(`/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  invitations: (workspaceId: string) => apiRequest<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`),
  invite: (workspaceId: string, dto: { email: string; role: 'MANAGER' | 'MEMBER' }) =>
    apiRequest<WorkspaceInvitation>(`/workspaces/${workspaceId}/members`, { method: 'POST', body: JSON.stringify(dto) }),
  revokeInvitation: (workspaceId: string, invitationId: string) =>
    apiRequest<{ success: boolean }>(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' }),
};
