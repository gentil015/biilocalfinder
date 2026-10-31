import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService phone changes', () => {
  let service: UsersService;
  let prisma: any;
  let verification: any;
  let audit: any;

  const currentUser = {
    id: 'user-1',
    email: 'jane@example.com',
    phone: '+250700000000',
    firstName: 'Jane',
    lastName: 'Doe',
    avatarUrl: null,
    role: 'PROVIDER',
    status: 'ACTIVE',
    emailVerified: true,
    phoneVerified: true,
    locale: 'en',
    createdAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      provider: { findMany: jest.fn().mockResolvedValue([{ id: 'provider-1' }, { id: 'provider-2' }]) },
      contactVerificationCode: { updateMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    verification = {
      recomputeProvider: jest.fn().mockResolvedValue(null),
      recomputeForUser: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, audit, {} as any, verification);
  });

  it('clears verification, consumes pending codes, and recomputes every owned provider when the number changes', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '+250700000000' })
      .mockResolvedValueOnce(currentUser);

    await service.updateMe('user-1', { phone: '+250788000000' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { phone: '+250788000000', phoneVerified: false },
    });
    expect(prisma.contactVerificationCode.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', channel: 'PHONE', consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
    expect(verification.recomputeProvider).toHaveBeenCalledTimes(2);
    expect(verification.recomputeProvider).toHaveBeenNthCalledWith(1, prisma, 'provider-1');
    expect(verification.recomputeProvider).toHaveBeenNthCalledWith(2, prisma, 'provider-2');
    expect(verification.recomputeForUser).toHaveBeenCalledWith('user-1');
    expect(audit.log).toHaveBeenCalledWith('user-1', 'USER_PHONE_CHANGED', 'User', 'user-1');
  });

  it('keeps verification and pending codes when the same number is saved again', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '+250700000000' })
      .mockResolvedValueOnce(currentUser);

    await service.updateMe('user-1', { phone: '+250700000000' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { phone: '+250700000000' },
    });
    expect(prisma.contactVerificationCode.updateMany).not.toHaveBeenCalled();
    expect(verification.recomputeProvider).not.toHaveBeenCalled();
    expect(verification.recomputeForUser).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('clears verification when the number is removed', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ phone: '+250700000000' })
      .mockResolvedValueOnce({ ...currentUser, phone: null, phoneVerified: false });

    await service.updateMe('user-1', { phone: null });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { phone: null, phoneVerified: false },
    });
    expect(verification.recomputeForUser).toHaveBeenCalledWith('user-1');
  });

  it('rejects a number already owned by another account', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ phone: null });
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'someone-else' });

    await expect(service.updateMe('user-1', { phone: '+250788000000' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
