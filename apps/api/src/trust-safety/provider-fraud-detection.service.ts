import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  VerificationCheckStatus,
  VerificationCheckType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrustSafetyService } from './trust-safety.service';
import {
  FRAUD_SIGNAL,
  FraudSignal,
  FraudSignalCode,
  findPublicContactDetail,
  intersects,
  isUsableIdentity,
  normalizeBusinessName,
  normalizeIdentity,
} from './provider-fraud-signals';

const SCREENING_CHECK_TYPE = VerificationCheckType.AUTOMATED_FRAUD_SCREENING;

const HIGH_CONFIDENCE_SIGNALS = new Set<FraudSignalCode>([
  FRAUD_SIGNAL.SHARED_VERIFICATION_DOCUMENT,
  FRAUD_SIGNAL.DUPLICATE_PROVIDER_IDENTITY,
]);

type ScreeningProvider = {
  id: string;
  businessName: string;
  description: string | null;
  bio: string | null;
  registrationNumber: string | null;
  services: Array<{ title: string | null; description: string | null }>;
  verifications: Array<{
    legalName: string | null;
    referenceNumber: string | null;
    documents: Array<{ contentHash: string | null }>;
  }>;
};

type DuplicateCandidate = {
  id: string;
  businessName: string;
  registrationNumber: string | null;
  verifications: Array<{ legalName: string | null; referenceNumber: string | null }>;
};

@Injectable()
export class ProviderFraudDetectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trustSafety: TrustSafetyService,
  ) {}

  async screenUser(userId: string, trigger: string, adminId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
        providers: {
          select: {
            id: true,
            businessName: true,
            description: true,
            bio: true,
            registrationNumber: true,
            services: { select: { title: true, description: true } },
            verifications: {
              select: {
                legalName: true,
                referenceNumber: true,
                documents: { select: { contentHash: true } },
              },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.providers.length) return { userId, checks: [], assessment: null };

    const providerIds = user.providers.map((provider) => provider.id);
    const ownHashes = new Map<string, Set<string>>();
    const ownIdentities = new Map<string, Set<string>>();
    const ownBusinessNames = new Map<string, string>();
    const identitySearchValues = new Set<string>();
    const businessNameSearchValues = new Set<string>();
    const allHashes = new Set<string>();

    for (const provider of user.providers) {
      const hashes = new Set<string>();
      for (const verification of provider.verifications) {
        for (const document of verification.documents) {
          if (!document.contentHash) continue;
          hashes.add(document.contentHash);
          allHashes.add(document.contentHash);
        }
      }
      ownHashes.set(provider.id, hashes);

      const identities = new Set<string>();
      const identityValues = [
        provider.registrationNumber,
        ...provider.verifications.flatMap((verification) => [
          verification.legalName,
          verification.referenceNumber,
        ]),
      ];
      for (const value of identityValues) {
        if (!isUsableIdentity(value)) continue;
        identities.add(normalizeIdentity(value));
        identitySearchValues.add(value!.trim());
      }
      ownIdentities.set(provider.id, identities);

      const businessName = normalizeBusinessName(provider.businessName);
      ownBusinessNames.set(provider.id, businessName);
      if (businessName.length >= 3) businessNameSearchValues.add(provider.businessName.trim());
    }

    const reusedDocuments = allHashes.size
      ? await this.prisma.verificationDocument.findMany({
          where: {
            contentHash: { in: [...allHashes] },
            verification: { providerId: { notIn: providerIds } },
          },
          select: {
            contentHash: true,
            verification: {
              select: {
                providerId: true,
                provider: { select: { businessName: true } },
              },
            },
          },
        })
      : [];

    const duplicates = await this.findPotentialDuplicates(
      providerIds,
      identitySearchValues,
      businessNameSearchValues,
    );
    const quotingProviders = await this.prisma.quote.findMany({
      where: { providerId: { in: providerIds } },
      distinct: ['providerId'],
      select: { providerId: true },
    });
    const quotingProviderIds = new Set(quotingProviders.map((quote) => quote.providerId));
    const reusedDocumentProviders = this.groupReusedDocuments(reusedDocuments);

    const results = user.providers.map((provider: ScreeningProvider) => {
      const signals: FraudSignal[] = [];
      const sharedDocumentProviders = new Map<string, string>();
      for (const hash of ownHashes.get(provider.id) ?? []) {
        for (const [otherProviderId, businessName] of reusedDocumentProviders.get(hash) ?? []) {
          sharedDocumentProviders.set(otherProviderId, businessName);
        }
      }
      if (sharedDocumentProviders.size) {
        signals.push({
          code: FRAUD_SIGNAL.SHARED_VERIFICATION_DOCUMENT,
          reason: `The same verification document was found on ${sharedDocumentProviders.size} other provider account(s).`,
          evidenceReference: [...sharedDocumentProviders.keys()][0],
        });
      }

      const identities = ownIdentities.get(provider.id) ?? new Set<string>();
      const duplicateIdentity = duplicates.find((candidate) =>
        intersects(identities, this.identitiesFor(candidate)),
      );
      if (duplicateIdentity) {
        signals.push({
          code: FRAUD_SIGNAL.DUPLICATE_PROVIDER_IDENTITY,
          reason: 'Registration or legal identity details match another provider account.',
          evidenceReference: duplicateIdentity.id,
        });
      }

      const businessName = ownBusinessNames.get(provider.id) ?? '';
      const duplicateBusinessName = duplicates.find((candidate) => {
        const candidateName = normalizeBusinessName(candidate.businessName);
        return candidateName.length >= 3 && candidateName === businessName;
      });
      if (duplicateBusinessName) {
        signals.push({
          code: FRAUD_SIGNAL.DUPLICATE_BUSINESS_NAME,
          reason: 'Business name matches another provider account.',
          evidenceReference: duplicateBusinessName.id,
        });
      }

      const contactKind = findPublicContactDetail([
        provider.description,
        provider.bio,
        ...provider.services.flatMap((service) => [service.title, service.description]),
      ]);
      if (contactKind) {
        signals.push({
          code: FRAUD_SIGNAL.PUBLIC_CONTACT_DETAILS,
          reason: `Public profile or service text exposes direct contact details (${contactKind}).`,
        });
      }

      if (quotingProviderIds.has(provider.id) && (!user.emailVerified || !user.phoneVerified)) {
        signals.push({
          code: FRAUD_SIGNAL.UNVERIFIED_CONTACT_ACTIVITY,
          reason: 'Account is quoting clients before email or phone verification is complete.',
        });
      }

      return { providerId: provider.id, signals };
    });

    const now = new Date();
    const checks = await this.prisma.$transaction(
      results.map((result) => {
        const status = this.statusFor(result.signals);
        return this.prisma.providerVerificationCheck.create({
          data: {
            providerId: result.providerId,
            checkType: SCREENING_CHECK_TYPE,
            status,
            details: result.signals.length
              ? result.signals.map((signal) => signal.reason).join(' ').slice(0, 1000)
              : null,
            evidence: {
              source: 'automated_provider_screening',
              trigger,
              screenedAt: now.toISOString(),
              signals: result.signals,
            } as Prisma.InputJsonValue,
          },
        });
      }),
    );

    const assessment = await this.trustSafety.reassess(userId, adminId);
    return { userId, checks, assessment };
  }

  private statusFor(signals: FraudSignal[]): VerificationCheckStatus {
    if (!signals.length) return VerificationCheckStatus.PASS;
    return signals.some((signal) => HIGH_CONFIDENCE_SIGNALS.has(signal.code))
      ? VerificationCheckStatus.FAIL
      : VerificationCheckStatus.WARNING;
  }

  private identitiesFor(candidate: DuplicateCandidate): Set<string> {
    const identities = new Set<string>();
    const values = [
      candidate.registrationNumber,
      ...candidate.verifications.flatMap((verification) => [
        verification.legalName,
        verification.referenceNumber,
      ]),
    ];
    for (const value of values) {
      if (isUsableIdentity(value)) identities.add(normalizeIdentity(value));
    }
    return identities;
  }

  private groupReusedDocuments(
    documents: Array<{
      contentHash: string | null;
      verification: { providerId: string; provider: { businessName: string } };
    }>,
  ): Map<string, Map<string, string>> {
    const grouped = new Map<string, Map<string, string>>();
    for (const document of documents) {
      if (!document.contentHash) continue;
      const providers = grouped.get(document.contentHash) ?? new Map<string, string>();
      providers.set(
        document.verification.providerId,
        document.verification.provider.businessName,
      );
      grouped.set(document.contentHash, providers);
    }
    return grouped;
  }

  private async findPotentialDuplicates(
    providerIds: string[],
    identities: Set<string>,
    businessNames: Set<string>,
  ): Promise<DuplicateCandidate[]> {
    const identityValues = [...identities];
    const businessNameValues = [...businessNames];
    const conditions: Prisma.ProviderWhereInput[] = [];

    if (identityValues.length) {
      conditions.push({
        registrationNumber: { in: identityValues, mode: 'insensitive' },
      });
      conditions.push({
        verifications: {
          some: {
            OR: [
              { legalName: { in: identityValues, mode: 'insensitive' } },
              { referenceNumber: { in: identityValues, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
    if (businessNameValues.length) {
      conditions.push({
        businessName: { in: businessNameValues, mode: 'insensitive' },
      });
    }
    if (!conditions.length) return [];

    return this.prisma.provider.findMany({
      where: { id: { notIn: providerIds }, OR: conditions },
      select: {
        id: true,
        businessName: true,
        registrationNumber: true,
        verifications: { select: { legalName: true, referenceNumber: true } },
      },
    });
  }
}
