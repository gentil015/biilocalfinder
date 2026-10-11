import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';

// Backend-enforced workspace authorization (spec §8): "Verify the
// authenticated user's membership in the requested workspace" and "Check
// workspace-specific roles and permissions". Never trust a workspaceId or
// role supplied by the frontend — this guard re-derives both from the
// database on every request, using the :workspaceId route param and the
// JWT-verified user (must run after JwtAuthGuard).
//
// A user who isn't an ACTIVE member of the workspace gets the same 403
// whether the workspace doesn't exist, they were never invited, or they
// were removed — not leaking which case it is.
@Injectable()
export class WorkspaceMembershipGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId: string | undefined = request.params?.workspaceId;
    const user = request.user;

    if (!workspaceId || !user) {
      throw new ForbiddenException('Workspace access denied');
    }

    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(WORKSPACE_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Your role does not permit this action');
    }

    request.workspaceMembership = membership;
    return true;
  }
}
