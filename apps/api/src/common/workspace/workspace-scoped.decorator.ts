import { SetMetadata } from '@nestjs/common';

export const WORKSPACE_SCOPED_KEY = 'workspaceScoped';
export const WorkspaceScoped = () => SetMetadata(WORKSPACE_SCOPED_KEY, true);
