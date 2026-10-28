import { SetMetadata } from '@nestjs/common';
import { WorkspacePermission } from '../../workspaces/workspace-permissions';

export const WORKSPACE_PERMISSION_KEY = 'workspacePermission';
export const RequireWorkspacePermission = (permission: WorkspacePermission) =>
  SetMetadata(WORKSPACE_PERMISSION_KEY, permission);
