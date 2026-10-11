import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceMembership } from '@prisma/client';

// Populated by WorkspaceMembershipGuard — only usable on routes guarded
// by it, since that's what verifies the caller actually belongs to the
// :workspaceId in the route and attaches their membership row.
export const CurrentWorkspaceMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceMembership => {
    const request = ctx.switchToHttp().getRequest();
    return request.workspaceMembership;
  },
);
