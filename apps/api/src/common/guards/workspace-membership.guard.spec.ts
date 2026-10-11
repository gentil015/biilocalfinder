import { ForbiddenException } from '@nestjs/common';
import { WorkspaceMembershipGuard } from './workspace-membership.guard';

function makeContext(params: any, user: any, requiredRoles?: string[]) {
  const request: any = { params, user };
  return {
    ctx: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    },
    request,
    reflector: { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) },
  };
}

describe('WorkspaceMembershipGuard', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = { workspaceMembership: { findUnique: jest.fn() } };
  });

  it('denies access when the caller has no membership row', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue(null);
    const { ctx, reflector } = makeContext({ workspaceId: 'ws-1' }, { id: 'user-1' });
    const guard = new WorkspaceMembershipGuard(prisma, reflector as any);

    await expect(guard.canActivate(ctx as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access for a REMOVED membership (does not leak the reason)', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue({ status: 'REMOVED', role: 'MEMBER' });
    const { ctx, reflector } = makeContext({ workspaceId: 'ws-1' }, { id: 'user-1' });
    const guard = new WorkspaceMembershipGuard(prisma, reflector as any);

    await expect(guard.canActivate(ctx as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access when the role does not meet @WorkspaceRoles requirement', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValue({ status: 'ACTIVE', role: 'MEMBER' });
    const { ctx, reflector } = makeContext({ workspaceId: 'ws-1' }, { id: 'user-1' }, ['OWNER', 'MANAGER']);
    const guard = new WorkspaceMembershipGuard(prisma, reflector as any);

    await expect(guard.canActivate(ctx as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows access and attaches the membership when active and role matches', async () => {
    const membership = { status: 'ACTIVE', role: 'OWNER' };
    prisma.workspaceMembership.findUnique.mockResolvedValue(membership);
    const { ctx, request, reflector } = makeContext({ workspaceId: 'ws-1' }, { id: 'user-1' }, ['OWNER']);
    const guard = new WorkspaceMembershipGuard(prisma, reflector as any);

    await expect(guard.canActivate(ctx as any)).resolves.toBe(true);
    expect(request.workspaceMembership).toBe(membership);
  });
});
