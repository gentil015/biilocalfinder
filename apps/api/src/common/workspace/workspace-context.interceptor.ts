import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { hasWorkspacePermission, WorkspacePermission } from '../../workspaces/workspace-permissions';
import { WORKSPACE_PERMISSION_KEY } from './require-workspace-permission.decorator';
import { WORKSPACE_SCOPED_KEY } from './workspace-scoped.decorator';
import { WorkspaceContext, WorkspaceContextService } from './workspace-context.service';

const WORKSPACE_HEADER = 'x-workspace-id';

@Injectable()
export class WorkspaceContextInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
    private readonly contexts: WorkspaceContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const permission = this.reflector.getAllAndOverride<WorkspacePermission | undefined>(
      WORKSPACE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const workspaceScoped = this.reflector.getAllAndOverride<boolean | undefined>(WORKSPACE_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const headerValue = request.headers?.[WORKSPACE_HEADER];
    const requestedWorkspaceId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    const userId: string | undefined = request.user?.id;

    if (!userId || (!permission && !workspaceScoped)) return next.handle();

    return from(this.resolve(userId, requestedWorkspaceId, permission)).pipe(
      mergeMap((workspaceContext) => {
        if (!workspaceContext) return next.handle();
        return new Observable((subscriber) =>
          this.contexts.run(workspaceContext, () => next.handle().subscribe(subscriber)),
        );
      }),
    );
  }

  private async resolve(
    userId: string,
    requestedWorkspaceId: string | undefined,
    permission: WorkspacePermission | undefined,
  ): Promise<WorkspaceContext | null> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(requestedWorkspaceId ? { workspaceId: requestedWorkspaceId } : {}),
      },
      include: { workspace: { select: { provider: { select: { id: true } } } } },
      take: 2,
    });

    if (requestedWorkspaceId && memberships.length === 0) {
      throw new ForbiddenException('You do not have access to this workspace');
    }
    if (memberships.length > 1) {
      throw new ConflictException(
        'You belong to more than one workspace. Send the x-workspace-id header to choose one.',
      );
    }

    const membership = memberships[0];
    if (!membership) {
      if (permission) throw new ForbiddenException('No active workspace membership found');
      return null;
    }
    if (permission && !hasWorkspacePermission(membership.role, permission)) {
      throw new ForbiddenException('Your workspace role does not permit this action');
    }

    return {
      userId,
      workspaceId: membership.workspaceId,
      membershipId: membership.id,
      role: membership.role,
      providerId: membership.workspace.provider?.id ?? null,
    };
  }
}
