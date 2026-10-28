import { WorkspaceMemberRole } from '@prisma/client';

export type WorkspacePermission =
  | 'workspace.profile.manage'
  | 'workspace.settings.manage'
  | 'workspace.members.view'
  | 'workspace.members.invite'
  | 'workspace.members.remove'
  | 'workspace.members.roles'
  | 'workspace.ownership.transfer'
  | 'workspace.billing.manage'
  | 'workspace.audit.view'
  | 'catalog.manage'
  | 'availability.manage'
  | 'requests.view'
  | 'quotes.manage'
  | 'bookings.view'
  | 'bookings.manage'
  | 'messages.manage'
  | 'reviews.respond'
  | 'verification.manage'
  | 'analytics.view'
  | 'assignments.manage';

const ALL: WorkspacePermission[] = [
  'workspace.profile.manage',
  'workspace.settings.manage',
  'workspace.members.view',
  'workspace.members.invite',
  'workspace.members.remove',
  'workspace.members.roles',
  'workspace.ownership.transfer',
  'workspace.billing.manage',
  'workspace.audit.view',
  'catalog.manage',
  'availability.manage',
  'requests.view',
  'quotes.manage',
  'bookings.view',
  'bookings.manage',
  'messages.manage',
  'reviews.respond',
  'verification.manage',
  'analytics.view',
  'assignments.manage',
];

export const WORKSPACE_PERMISSIONS: Record<WorkspaceMemberRole, ReadonlySet<WorkspacePermission>> = {
  OWNER: new Set(ALL),
  MANAGER: new Set(
    ALL.filter(
      (permission) =>
        permission !== 'workspace.billing.manage' &&
        permission !== 'workspace.ownership.transfer' &&
        permission !== 'workspace.members.roles',
    ),
  ),
  MEMBER: new Set<WorkspacePermission>([
    'workspace.members.view',
    'requests.view',
    'quotes.manage',
    'bookings.view',
    'bookings.manage',
    'messages.manage',
  ]),
};

export function hasWorkspacePermission(
  role: WorkspaceMemberRole,
  permission: WorkspacePermission,
): boolean {
  return WORKSPACE_PERMISSIONS[role].has(permission);
}
