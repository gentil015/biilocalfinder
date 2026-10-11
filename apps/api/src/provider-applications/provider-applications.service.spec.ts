import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProviderApplicationsService } from './provider-applications.service';

describe('ProviderApplicationsService', () => {
  let service: ProviderApplicationsService;
  let prisma: any;
  let notifications: any;
  let auditLog: any;
  let tx: any;

  const userId = 'client-user-1';

  const validDto = {
    providerType: 'BUSINESS' as const,
    businessName: 'Bright Spark Cleaning',
    description: 'Deep cleaning for offices',
    phone: '+250788000222',
    yearsOfExperience: 7,
    categories: ['cleaning'],
  };

  beforeEach(() => {
    tx = {
      workspace: { create: jest.fn(), findUnique: jest.fn() },
      provider: { create: jest.fn() },
      workspaceMembership: { create: jest.fn() },
      user: { updateMany: jest.fn() },
      providerApplication: { updateMany: jest.fn() },
    };

    prisma = {
      user: { findUnique: jest.fn(), updateMany: jest.fn() },
      providerApplication: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      workspace: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    notifications = { notify: jest.fn() };
    auditLog = { log: jest.fn() };
    service = new ProviderApplicationsService(prisma, notifications, auditLog);

    prisma.user.findUnique.mockResolvedValue({ id: userId, role: 'CLIENT', status: 'ACTIVE' });
    prisma.providerApplication.findFirst.mockResolvedValue(null);
    prisma.providerApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      userId,
      status: 'PENDING',
      providerType: 'BUSINESS',
      businessName: 'Bright Spark Cleaning',
      description: 'Deep cleaning for offices',
      phone: '+250788000222',
      yearsOfExperience: 7,
      registrationNumber: null,
      categories: ['cleaning'],
    });
    prisma.providerApplication.create.mockResolvedValue({ id: 'app-1', status: 'PENDING' });
    // Both review paths claim the row with a conditional updateMany. Returning
    // count 1 is the "I won the claim" case; count 0 means a rival admin (or a
    // rival approve/reject) got there first, and the service must abort.
    prisma.providerApplication.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.providerApplication.updateMany.mockResolvedValue({ count: 1 });
    prisma.workspace.findUnique.mockResolvedValue(null);
    tx.workspace.findUnique.mockResolvedValue(null);
    tx.workspace.create.mockResolvedValue({ id: 'ws-1' });
    tx.provider.create.mockResolvedValue({ id: 'prov-1', workspaceId: 'ws-1' });
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));
  });

  describe('submit', () => {
    it('creates a PENDING application without touching Provider or Workspace', async () => {
      const result = await service.submit(userId, validDto);

      expect(result.status).toBe('PENDING');
      const data = prisma.providerApplication.create.mock.calls[0][0].data;
      expect(data.userId).toBe(userId);
      // No explicit status: the column default is PENDING, so an insert can
      // never be created pre-approved.
      expect(data.status).toBeUndefined();
      // The upgrade happens on approval only — a PENDING application must not
      // leave a half-built provider profile behind.
      expect(tx.provider.create).not.toHaveBeenCalled();
      expect(prisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('trims text and nulls out empty optionals', async () => {
      await service.submit(userId, { providerType: 'INDIVIDUAL', businessName: '  Ana_styles  ', phone: '   ' });

      const data = prisma.providerApplication.create.mock.calls[0][0].data;
      expect(data.businessName).toBe('Ana_styles');
      expect(data.phone).toBeNull();
      expect(data.categories).toEqual([]);
    });

    it('refuses a second pending application', async () => {
      prisma.providerApplication.findFirst.mockResolvedValue({ id: 'app-existing' });

      await expect(service.submit(userId, validDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('translates the partial-unique-index violation into a 409', async () => {
      // Simulates the double-submit race the read above cannot see. Needs a
      // real Prisma error instance — the service checks the class, not a
      // duck-typed `code`.
      prisma.providerApplication.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed on "userId"', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );

      await expect(service.submit(userId, validDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses an account that already trades', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, role: 'PROVIDER', status: 'ACTIVE' });

      await expect(service.submit(userId, validDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses an admin account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, role: 'ADMIN', status: 'ACTIVE' });

      await expect(service.submit(userId, validDto)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses a suspended account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: userId, role: 'CLIENT', status: 'SUSPENDED' });

      await expect(service.submit(userId, validDto)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('approve', () => {
    it('upgrades the same account instead of creating a new user', async () => {
      await service.approve('app-1', 'admin-1', {});

      // Role flip on the existing user — the crux of the whole feature. The WHERE
      // clause is part of the guarantee, not incidental: it is what stops a
      // racing second approval from attaching a second provider to this person.
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: userId, role: { not: 'PROVIDER' } },
        data: { role: 'PROVIDER' },
      });
      // No second user row anywhere.
      expect(prisma.user.create).toBeUndefined();
    });

    it('creates the workspace with the applied type so the switcher agrees immediately', async () => {
      await service.approve('app-1', 'admin-1', {});

      expect(tx.workspace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'BUSINESS', ownerId: userId, name: 'Bright Spark Cleaning' }),
        }),
      );
    });

    it('copies the applied details onto the provider and resumes onboarding', async () => {
      await service.approve('app-1', 'admin-1', {});

      const data = tx.provider.create.mock.calls[0][0].data;
      expect(data.businessName).toBe('Bright Spark Cleaning');
      expect(data.description).toBe('Deep cleaning for offices');
      expect(data.yearsOfExperience).toBe(7);
      expect(data.providerType).toBe('BUSINESS');
      // Type selection and the basics are already answered by the application.
      expect(data.onboardingStep).toBe('PROFILE_DETAILS');
    });

    it('sets the applicant as workspace owner', async () => {
      await service.approve('app-1', 'admin-1', {});

      expect(tx.workspaceMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: 'ws-1', userId, role: 'OWNER', status: 'ACTIVE' }),
        }),
      );
    });

    it('marks the application approved and notifies the applicant', async () => {
      await service.approve('app-1', 'admin-1', { note: 'Docs look good' });

      expect(tx.providerApplication.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1', status: 'PENDING' },
          data: expect.objectContaining({ status: 'APPROVED', decisionNote: 'Docs look good' }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId, title: expect.stringContaining('approved') }),
      );
    });

    it('refuses to approve an application already decided', async () => {
      prisma.providerApplication.findUnique.mockResolvedValue({
        id: 'app-1',
        userId,
        status: 'REJECTED',
        providerType: 'INDIVIDUAL',
        businessName: 'X',
      });

      await expect(service.approve('app-1', 'admin-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses when the applicant became a provider in the meantime', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'PROVIDER',
        status: 'ACTIVE',
        firstName: 'A',
        lastName: 'B',
      });

      await expect(service.approve('app-1', 'admin-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('refuses when the applicant account is suspended', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'CLIENT',
        status: 'SUSPENDED',
        firstName: 'A',
        lastName: 'B',
      });

      await expect(service.approve('app-1', 'admin-1', {})).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reject', () => {
    it('records the reason so the applicant can see why', async () => {
      await service.reject('app-1', 'admin-1', { reason: 'Could not verify your ID number' });

      expect(prisma.providerApplication.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-1', status: 'PENDING' },
          data: expect.objectContaining({
            status: 'REJECTED',
            decisionNote: 'Could not verify your ID number',
          }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId, body: 'Could not verify your ID number' }),
      );
    });

    it('never upgrades the account', async () => {
      await service.reject('app-1', 'admin-1', { reason: 'Not now' });

      expect(tx.user.updateMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // The pre-read above these is only there to give a friendly error. These two
  // cover the case it cannot see: a second admin clicking at the same moment,
  // where both requests read PENDING and only the atomic claim can separate
  // them. Without the claim, the loser would still build a workspace and a
  // provider for a person who already has one.
  describe('concurrent review', () => {
    it('aborts an approval whose row was already claimed by a rival decision', async () => {
      tx.providerApplication.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approve('app-1', 'admin-1', {})).rejects.toBeInstanceOf(ConflictException);
      // Nothing may be written once the claim is lost — a partial upgrade here
      // is exactly the duplicate-provider bug.
      expect(tx.workspace.create).not.toHaveBeenCalled();
      expect(tx.provider.create).not.toHaveBeenCalled();
      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });

    it('aborts a rejection whose row was already claimed by a rival decision', async () => {
      prisma.providerApplication.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reject('app-1', 'admin-1', { reason: 'Race' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('aborts when the account became a provider between the pre-read and the claim', async () => {
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.approve('app-1', 'admin-1', {})).rejects.toBeInstanceOf(ConflictException);
      expect(tx.provider.create).not.toHaveBeenCalled();
    });
  });
});