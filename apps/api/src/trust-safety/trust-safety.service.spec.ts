import { BadRequestException } from '@nestjs/common';
import { RiskScoringService } from './risk-scoring.service';
import { TrustSafetyService } from './trust-safety.service';

describe('TrustSafetyService', () => {
  let service: TrustSafetyService;
  let prisma: any;
  let auditLog: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    auditLog = { log: jest.fn() };
    service = new TrustSafetyService(prisma, auditLog, new RiskScoringService());
  });

  it('rejects a report against the reporter without touching the database', async () => {
    await expect(
      service.createReport('user-1', {
        reportedUserId: 'user-1',
        category: 'OTHER',
        description: 'This report is intentionally long enough for validation.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires an expiry for temporary suspensions before opening a transaction', async () => {
    await expect(
      service.createRestriction('admin-1', {
        userId: 'user-1',
        restrictionType: 'TEMPORARY_SUSPENSION',
        reason: 'A human-reviewed restriction with enough detail.',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed event idempotency keys', async () => {
    await expect(
      service.recordEvent('user-1', 'PROFILE_UPDATED', 'contains whitespace'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records an event and assessment without exposing private risk details to the caller', async () => {
    const tx = {
      securityEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
      fraudRule: { findMany: jest.fn().mockResolvedValue([]) },
      providerVerificationCheck: { findMany: jest.fn().mockResolvedValue([]) },
      fraudReport: { count: jest.fn().mockResolvedValue(0) },
      riskAssessment: { create: jest.fn().mockResolvedValue({ id: 'assessment-1', riskScore: 0 }) },
    };
    prisma.$transaction.mockImplementation((callback: (transaction: any) => unknown) => callback(tx));

    await expect(service.recordEvent('user-1', 'PROFILE_UPDATED')).resolves.toEqual({
      accepted: true,
      eventId: 'event-1',
    });
    expect(tx.riskAssessment.create).toHaveBeenCalled();
  });
});
