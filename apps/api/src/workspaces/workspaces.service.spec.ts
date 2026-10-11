import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
        update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
        create: jest.fn((args) => ({ id: 'ws-new', ...args.data })),
      },
      provider: { updateMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    prisma.$transaction = jest.fn((cb: any) =>
      cb({ workspace: prisma.workspace, provider: prisma.provider, workspaceMembership: prisma.workspaceMembership }),
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
    it('rejects inviting an email with no account', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.inviteMember('ws-1', { email: 'nobody@example.com', role: 'MEMBER' as any }, 'owner-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
    });

    it('creates an INVITED membership for a known account and audit-logs it', async () => {
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
      expect(result.status).toBe('INVITED');
      expect(auditLog.log).toHaveBeenCalledWith(
        'owner-1',
        'WORKSPACE_MEMBER_INVITED',
        'WorkspaceMembership',
        expect.any(String),
        expect.objectContaining({ workspaceId: 'ws-1', invitedUserId: 'user-2', role: 'MANAGER' }),
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
