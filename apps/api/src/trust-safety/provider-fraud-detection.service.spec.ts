import { VerificationCheckStatus, VerificationCheckType } from '@prisma/client';
import { ProviderFraudDetectionService } from './provider-fraud-detection.service';

describe('ProviderFraudDetectionService', () => {
  let prisma: any;
  let trustSafety: any;
  let service: ProviderFraudDetectionService;

  function provider(overrides: Record<string, unknown> = {}) {
    return {
      id: 'provider-1',
      businessName: 'Bright Spark Cleaning',
      description: 'Professional home cleaning.',
      bio: null,
      registrationNumber: 'REG-001',
      services: [{ title: 'Deep cleaning', description: null }],
      verifications: [
        {
          legalName: 'Bright Spark Cleaning Ltd',
          referenceNumber: 'REG-001',
          documents: [{ contentHash: 'hash-1' }],
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      verificationDocument: { findMany: jest.fn().mockResolvedValue([]) },
      provider: { findMany: jest.fn().mockResolvedValue([]) },
      quote: { findMany: jest.fn().mockResolvedValue([]) },
      providerVerificationCheck: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'check-1', ...data })),
      },
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
    };
    trustSafety = { reassess: jest.fn().mockResolvedValue({ id: 'assessment-1' }) };
    service = new ProviderFraudDetectionService(prisma, trustSafety);
  });

  it('flags reused documents and duplicate identities as a failed screening', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerified: false,
      phoneVerified: false,
      providers: [
        provider({ description: 'Call us on +250 788 123 456' }),
      ],
    });
    prisma.verificationDocument.findMany.mockResolvedValue([
      {
        contentHash: 'hash-1',
        verification: { providerId: 'provider-2', provider: { businessName: 'Other Cleaning' } },
      },
    ]);
    prisma.provider.findMany.mockResolvedValue([
      {
        id: 'provider-2',
        businessName: 'Other Cleaning',
        registrationNumber: 'REG-001',
        verifications: [{ legalName: null, referenceNumber: 'REG-001' }],
      },
    ]);
    prisma.quote.findMany.mockResolvedValue([{ providerId: 'provider-1' }]);

    const result = await service.screenUser('user-1', 'verification_submitted', 'admin-1');

    const data = prisma.providerVerificationCheck.create.mock.calls[0][0].data;
    expect(data.checkType).toBe(VerificationCheckType.AUTOMATED_FRAUD_SCREENING);
    expect(data.status).toBe(VerificationCheckStatus.FAIL);
    expect(data.evidence.signals.map((signal: { code: string }) => signal.code)).toEqual(
      expect.arrayContaining([
        'shared_verification_document',
        'duplicate_provider_identity',
        'public_contact_details',
        'unverified_contact_activity',
      ]),
    );
    expect(result.assessment).toEqual({ id: 'assessment-1' });
    expect(trustSafety.reassess).toHaveBeenCalledWith('user-1', 'admin-1');
  });

  it('records a passing screening when no signals are found', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      emailVerified: true,
      phoneVerified: true,
      providers: [provider({ description: 'Professional home cleaning.', verifications: [] })],
    });

    await service.screenUser('user-1', 'verification_submitted');

    const data = prisma.providerVerificationCheck.create.mock.calls[0][0].data;
    expect(data.status).toBe(VerificationCheckStatus.PASS);
    expect(data.details).toBeNull();
    expect(data.evidence.signals).toEqual([]);
    expect(trustSafety.reassess).toHaveBeenCalledWith('user-1', undefined);
  });
});
