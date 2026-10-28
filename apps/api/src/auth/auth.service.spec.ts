import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: JwtService;
  let emailSender: { send: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    emailSender = { send: jest.fn().mockResolvedValue(undefined) };
    jwt = new JwtService();
    service = new AuthService(prisma, jwt, emailSender);
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  it('rejects registration when the email is already taken', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        email: 'taken@example.com',
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        role: 'CLIENT' as any,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('never allows self-registration as ADMIN, even if a caller bypasses DTO validation', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.register({
        email: 'wannabe-admin@example.com',
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        role: 'ADMIN' as any, // simulates a direct API call bypassing the DTO's @IsIn check
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a Workspace, Provider, and OWNER membership for a PROVIDER signup, atomically', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    const createdUser = { id: 'user-1', email: 'plumber@example.com', role: 'PROVIDER' };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      workspace: { create: jest.fn().mockResolvedValue({ id: 'ws-1' }), findUnique: jest.fn().mockResolvedValue(null) },
      provider: { create: jest.fn().mockResolvedValue({ id: 'provider-1' }) },
      workspaceMembership: { create: jest.fn().mockResolvedValue({ id: 'm-1' }) },
    };
    prisma.$transaction = jest.fn((cb: any) => cb(tx));
    jest.spyOn(service as any, 'issueTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

    await service.register({
      email: 'plumber@example.com',
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Plumber',
      role: 'PROVIDER' as any,
    });

    expect(tx.workspace.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'INDIVIDUAL', ownerId: 'user-1' }) }),
    );
    expect(tx.provider.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', workspaceId: 'ws-1' }) }),
    );
    expect(tx.workspaceMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-1', role: 'OWNER', status: 'ACTIVE' }),
      }),
    );
  });

  it('maps a unique-constraint violation to 409, so a registration racing the duplicate pre-check is not a 500', async () => {
    prisma.user.findFirst.mockResolvedValue(null); // pre-check sees nothing...
    prisma.$transaction = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: 'users_email_key' },
      }),
    );

    await expect(
      service.register({
        email: 'racer@example.com',
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        role: 'CLIENT' as any,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows non-constraint errors unchanged instead of masking them as a conflict', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.$transaction = jest.fn().mockRejectedValue(new Error('connection lost'));

    await expect(
      service.register({
        email: 'unlucky@example.com',
        password: 'password123',
        firstName: 'A',
        lastName: 'B',
        role: 'CLIENT' as any,
      }),
    ).rejects.toThrow('connection lost');
  });

  it('rejects login with an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: 'whatever' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login for a non-active account', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('password123', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'x@example.com',
      passwordHash: hash,
      status: 'SUSPENDED',
      role: 'CLIENT',
    });

    await expect(
      service.login({ email: 'x@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  describe('password reset', () => {
    const user = { id: 'user-1', email: 'a@example.com', firstName: 'A' };

    // The request endpoint pads its runtime (RESET_REQUEST_MIN_MS) so an
    // unknown address isn't distinguishable by response time. The padding is
    // left real here — stubbing it out would test the wrong code path, and
    // 300ms x a handful of cases is a fine price for that.
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('stores only a hash of the emailed token, never the token itself', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('a@example.com');

      const { data } = prisma.passwordResetToken.create.mock.calls[0][0];
      const emailed = emailSender.send.mock.calls[0][0].body;
      expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(data.tokenHash).not.toContain(emailed);
      const code = /Your verification code: (\d{6})/.exec(emailed)![1];
      expect(code).toHaveLength(6);
      // Keyed HMAC, not a plain digest: the 6-digit space is trivially
      // reversible if a database dump contains only SHA-256(code).
      expect(data.tokenHash).toBe(
        require('crypto').createHmac('sha256', 'test-secret').update(code).digest('hex'),
      );
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('retires outstanding tokens so only the newest emailed link still works', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('a@example.com');

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('answers identically for an unknown address, and sends nothing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nobody@example.com');

      expect(result).toEqual({
        success: true,
        message: 'If that email exists, a reset code has been sent.',
      });
      expect(emailSender.send).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('still answers generically when the email provider fails, so SMTP state cannot enumerate accounts', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({});
      emailSender.send.mockRejectedValue(new Error('SMTP down'));

      const result = await service.requestPasswordReset('a@example.com');

      expect(result).toEqual({
        success: true,
        message: 'If that email exists, a reset code has been sent.',
      });
    });

    it('resets the password, spends the token, and revokes every refresh token in one transaction', async () => {
      const tx = {
        user: { update: jest.fn().mockResolvedValue({}) },
        passwordResetToken: { update: jest.fn().mockResolvedValue({}) },
        refreshToken: { updateMany: jest.fn().mockResolvedValue({}) },
      };
      prisma.passwordResetToken.findFirst.mockResolvedValue({ id: 'prt-1', userId: 'user-1' });
      prisma.$transaction = jest.fn((cb: any) => cb(tx));

      await service.resetPassword('raw-token', 'newpassword123');

      expect(prisma.passwordResetToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tokenHash: require('crypto')
              .createHmac('sha256', 'test-secret')
              .update('raw-token')
              .digest('hex'),
            usedAt: null,
          }),
        }),
      );
      // The new password is stored hashed, never in the clear.
      const stored = tx.user.update.mock.calls[0][0].data.passwordHash;
      expect(stored).not.toBe('newpassword123');
      expect(await require('bcrypt').compare('newpassword123', stored)).toBe(true);
      expect(tx.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prt-1' }, data: { usedAt: expect.any(Date) } }),
      );
      expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown, used, or expired token with one generic 400, and writes nothing', async () => {
      // Used/expired rows are excluded by the lookup itself rather than by a
      // JS check, so "no row" is the single rejection path all three share.
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('whatever', 'newpassword123')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).toBeUndefined();

      // The filter that makes an already-used or expired token unreachable.
      expect(prisma.passwordResetToken.findFirst.mock.calls[0][0].where).toEqual({
        tokenHash: expect.any(String),
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      });
    });
  });
});
