import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prisma: any;
  let auditLog: any;
  let entitlements: any;

  beforeEach(() => {
    prisma = {
      workspaceMembership: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn((args) => ({ id: 'membership-new', ...args.data })),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
      },
      workspace: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ name: 'Acme Cleaning' }),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
        create: jest.fn((args) => ({ id: 'ws-new', ...args.data })),
      },
      workspaceInvitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn((args) => ({ id: 'invitation-new', ...args.data })),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
      },
      provider: { updateMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ firstName: 'Ada', lastName: 'Owner' }),
      },
    };
    prisma.$transaction = jest.fn((cb: any) =>
      cb({
        workspace: prisma.workspace,
        provider: prisma.provider,
        workspaceMembership: prisma.workspaceMembership,
        workspaceInvitation: prisma.workspaceInvitation,
      }),
    );
    auditLog = { log: jest.fn() };
    entitlements = { assertCanAdd: jest.fn().mockResolvedValue(undefined) };
    service = new WorkspacesService(prisma, auditLog, entitlements);
  });

  describe('create', () => {
    it('creates a Workspace, Provider, and OWNER membership together and audit-logs it', async () => {
      prisma.workspace.findUnique
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ id: 'ws-new', name: 'Acme Cleaning', type: 'BUSINESS', provider: null, memberships: [] }); // getContext

      const result = await service.create('user-1', { type: 'BUSINESS' as any, name: 'Acme Cleaning' });

      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Acme Cleaning', type: 'BUSINESS', ownerId: 'user-1' }),
        }),
      );
      expect(prisma.provider.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-new', providerType: 'BUSINESS' }) }),
      );
      expect(prisma.workspaceMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-new', userId: 'user-1', role: 'OWNER', status: 'ACTIVE' }),
        }),
      );
      expect(auditLog.log).toHaveBeenCalledWith('user-1', 'WORKSPACE_CREATED', 'Workspace', 'ws-new', { type: 'BUSINESS' });
      expect(result).toBeDefined();
    });

    it('de-duplicates the slug when the name collides with an existing workspace', async () => {
      prisma.workspace.findUnique
        .mockResolvedValueOnce({ id: 'other-ws' }) // 'acme-cleaning' taken
        .mockResolvedValueOnce(null) // 'acme-cleaning-2' free
        .mockResolvedValueOnce({ id: 'ws-new', name: 'Acme Cleaning', type: 'TEAM', provider: null, memberships: [] }); // getContext

      await service.create('user-1', { type: 'TEAM' as any, name: 'Acme Cleaning' });

      expect(prisma.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'acme-cleaning-2' }) }),
      );
    });
  });

  describe('getContext', () => {
    it('sends rating as a JSON number, not the string Prisma serialises Decimal to', async () => {
      // A raw Decimal reaches the service as an object whose JSON form is a
      // string. The web app types this field as `number` and calls .toFixed()
      // on it, so a leak here is an unhandled TypeError in the dashboard.
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Acme Cleaning',
        type: 'BUSINESS',
        memberships: [],
        provider: {
          id: 'p-1',
          businessName: 'Acme Cleaning',
          logoUrl: null,
          verificationStatus: 'VERIFIED',
          subscriptionStatus: 'ACTIVE',
          availabilityStatus: 'AVAILABLE',
          rating: new Prisma.Decimal('4.50'),
          reviewCount: 12,
        },
      });

      const result = await service.getContext('ws-1');

      expect(result.provider?.rating).toBe(4.5);
      expect(typeof result.provider?.rating).toBe('number');
      expect(JSON.parse(JSON.stringify(result)).provider.rating).toBe(4.5);
    });

    it('leaves a null provider as null', async () => {
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Acme Cleaning',
        type: 'BUSINESS',
        memberships: [],
        provider: null,
      });

      const result = await service.getContext('ws-1');

      expect(result.provider).toBeNull();
    });
  });

  describe('inviteMember', () => {
    it('creates a pending invitation for an email with no account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.inviteMember(
        'ws-1',
        { email: 'Nobody@Example.com ', role: 'MEMBER' as any },
        'owner-1',
      );

      expect(prisma.workspaceMembership.create).not.toHaveBeenCalled();
      expect(prisma.workspaceInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-1', email: 'nobody@example.com', role: 'MEMBER' }),
        }),
      );
      expect(result.email).toBe('nobody@example.com');
      expect(result.tokenHash).toHaveLength(64);
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_MEMBER_INVITED',
        'WorkspaceInvitation',
        'invitation-new',
        expect.objectContaining({ workspaceId: 'ws-1', invitedEmail: 'nobody@example.com', role: 'MEMBER' }),
      );
    });

    it('rejects inviting someone who already has active access', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'm-1', status: 'ACTIVE' });

      await expect(
        service.inviteMember('ws-1', { email: 'existing@example.com', role: 'MEMBER' as any }, 'owner-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('enforces the plan-based team-member limit before inviting', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);
      prisma.provider.findUnique.mockResolvedValue({ id: 'provider-1', providerType: 'TEAM', workspaceId: 'ws-1' });
      entitlements.assertCanAdd.mockRejectedValue(new BadRequestException('limit reached'));

      await expect(
        service.inviteMember('ws-1', { email: 'existing@example.com', role: 'MEMBER' as any }, 'owner-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(entitlements.assertCanAdd).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'provider-1' }),
        'teamMembers',
      );
      expect(prisma.workspaceMembership.create).not.toHaveBeenCalled();
      expect(prisma.workspaceInvitation.create).not.toHaveBeenCalled();
    });

    it('creates an INVITED membership and invitation for a known account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);

      const result = await service.inviteMember(
        'ws-1',
        { email: 'existing@example.com', role: 'MANAGER' as any },
        'owner-1',
      );

      expect(prisma.workspaceMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-2', role: 'MANAGER', status: 'INVITED' }),
        }),
      );
      expect(prisma.workspaceInvitation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-1', email: 'existing@example.com', role: 'MANAGER' }),
        }),
      );
      expect(result.workspaceId).toBe('ws-1');
      expect(result.email).toBe('existing@example.com');
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_MEMBER_INVITED',
        'WorkspaceInvitation',
        'invitation-new',
        expect.objectContaining({ workspaceId: 'ws-1', invitedUserId: 'user-2', role: 'MANAGER' }),
      );
    });

    it('reuses a pending invitation instead of re-checking the seat limit', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'm-1', status: 'INVITED' });
      prisma.workspaceInvitation.findFirst.mockResolvedValue({ id: 'invitation-existing' });

      await service.inviteMember('ws-1', { email: 'existing@example.com', role: 'MEMBER' as any }, 'owner-1');

      expect(entitlements.assertCanAdd).not.toHaveBeenCalled();
      expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'invitation-existing' } }),
      );
    });
  });

  describe('acceptInvite', () => {
    it('rejects accepting an invitation addressed to someone else', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-2',
        status: 'INVITED',
      });

      await expect(service.acceptInvite('ws-1', 'm-1', 'someone-else')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('activates a matching pending invitation', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({
        id: 'm-1',
        workspaceId: 'ws-1',
        userId: 'user-2',
        status: 'INVITED',
      });

      const result = await service.acceptInvite('ws-1', 'm-1', 'user-2');

      expect(result.status).toBe('ACTIVE');
      expect(prisma.workspaceMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm-1' }, data: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
    });
  });

  describe('acceptInvitationToken', () => {
    it('rejects an invitation addressed to a different email', async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'invited@example.com',
        role: 'MEMBER',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'someone@example.com' });

      await expect(service.acceptInvitationToken('raw-token', 'user-2')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('activates the membership and marks the invitation accepted', async () => {
      prisma.workspaceInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        workspaceId: 'ws-1',
        email: 'invited@example.com',
        role: 'MANAGER',
        expiresAt: new Date(Date.now() + 60_000),
        acceptedAt: null,
        revokedAt: null,
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'Invited@example.com' });
      prisma.workspaceMembership.findUnique.mockResolvedValue(null);
      prisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Acme Cleaning',
        type: 'TEAM',
        memberships: [],
        provider: null,
      });

      const result = await service.acceptInvitationToken('raw-token', 'user-2');

      expect(prisma.workspaceMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-2', role: 'MANAGER', status: 'ACTIVE' }),
        }),
      );
      expect(prisma.workspaceInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv-1' }, data: expect.objectContaining({ acceptedAt: expect.any(Date) }) }),
      );
      expect(result.id).toBe('ws-1');
      expect(auditLog.log).toHaveBeenCalledWith(
        'user-2',
        'WORKSPACE_MEMBER_JOINED',
        'WorkspaceMembership',
        'membership-new',
        expect.objectContaining({ workspaceId: 'ws-1', invitationId: 'inv-1', role: 'MANAGER' }),
      );
    });
  });

  describe('transferOwnership', () => {
    it('promotes the target, demotes the current owner, and moves ownerId', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ id: 'ws-1', ownerId: 'owner-1' });
      prisma.workspaceMembership.findUnique
        .mockResolvedValueOnce({ id: 'm-2', workspaceId: 'ws-1', userId: 'user-2', role: 'MANAGER', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'm-1', workspaceId: 'ws-1', userId: 'owner-1', role: 'OWNER' });

      await service.transferOwnership('ws-1', 'm-2', 'owner-1');

      expect(prisma.workspaceMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm-1' }, data: { role: 'MANAGER' } }),
      );
      expect(prisma.workspaceMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm-2' }, data: { role: 'OWNER' } }),
      );
      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ws-1' }, data: { ownerId: 'user-2' } }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_OWNERSHIP_TRANSFERRED',
        'Workspace',
        'ws-1',
        expect.objectContaining({ fromUserId: 'owner-1', toUserId: 'user-2' }),
      );
    });

    it('rejects transferring to an inactive member', async () => {
      prisma.workspace.findUnique.mockResolvedValue({ id: 'ws-1', ownerId: 'owner-1' });
      prisma.workspaceMembership.findUnique.mockResolvedValue({
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'user-2',
        role: 'MEMBER',
        status: 'INVITED',
      });

      await expect(service.transferOwnership('ws-1', 'm-2', 'owner-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('assignment', () => {
    it('assigns a request to an active workspace member', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'provider-1', workspaceId: 'ws-1' });
      prisma.serviceRequest = {
        findUnique: jest.fn().mockResolvedValue({ id: 'request-1', providerId: 'provider-1' }),
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
      };
      prisma.workspaceMembership.findUnique.mockResolvedValue({
        id: 'm-2',
        workspaceId: 'ws-1',
        userId: 'user-2',
        status: 'ACTIVE',
      });

      const result = await service.assignRequest('ws-1', 'request-1', 'm-2', 'owner-1');

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'request-1' },
          data: expect.objectContaining({ assignedMembershipId: 'm-2', assignedById: 'owner-1' }),
        }),
      );
      expect(result.assignedMembershipId).toBe('m-2');
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_REQUEST_ASSIGNED',
        'ServiceRequest',
        'request-1',
        expect.objectContaining({ workspaceId: 'ws-1', assignedUserId: 'user-2' }),
      );
    });

    it('rejects assigning to a member of another workspace', async () => {
      prisma.provider.findUnique.mockResolvedValue({ id: 'provider-1', workspaceId: 'ws-1' });
      prisma.serviceRequest = {
        findUnique: jest.fn().mockResolvedValue({ id: 'request-1', providerId: 'provider-1' }),
        update: jest.fn(),
      };
      prisma.workspaceMembership.findUnique.mockResolvedValue({
        id: 'm-other',
        workspaceId: 'ws-other',
        userId: 'user-2',
        status: 'ACTIVE',
      });

      await expect(service.assignRequest('ws-1', 'request-1', 'm-other', 'owner-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('member management guards the OWNER row', () => {
    it('refuses to change the owner role', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', role: 'OWNER' });

      await expect(
        service.updateMemberRole('ws-1', 'm-1', { role: 'MANAGER' as any }, 'someone'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses to remove the owner', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'm-1', workspaceId: 'ws-1', role: 'OWNER' });

      await expect(service.removeMember('ws-1', 'm-1', 'someone')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows demoting/removing a MANAGER and audit-logs it', async () => {
      prisma.workspaceMembership.findUnique.mockResolvedValue({ id: 'm-2', workspaceId: 'ws-1', role: 'MANAGER' });

      await service.removeMember('ws-1', 'm-2', 'owner-1');

      expect(prisma.workspaceMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'm-2' }, data: { status: 'REMOVED' } }),
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_MEMBER_REMOVED',
        'WorkspaceMembership',
        'm-2',
        expect.objectContaining({ workspaceId: 'ws-1' }),
      );
    });
  });
});
