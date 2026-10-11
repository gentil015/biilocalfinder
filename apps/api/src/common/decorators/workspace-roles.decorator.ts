import { SetMetadata } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

// Distinct from ROLES_KEY (UserRole, e.g. PROVIDER vs CLIENT vs ADMIN):
// this governs a member's role *within one workspace* (spec §8: "Check
// workspace-specific roles and permissions"). A route with no
// @WorkspaceRoles(...) still requires an ACTIVE membership (enforced by
// WorkspaceMembershipGuard on its own) — it just doesn't narrow by role.
export const WORKSPACE_ROLES_KEY = 'workspaceRoles';
export const WorkspaceRoles = (...roles: WorkspaceMemberRole[]) =>
  SetMetadata(WORKSPACE_ROLES_KEY, roles);
