import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { RETENTION } from './data-retention.constants';

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Deletes data that has outlived its stated purpose. This is intentionally
// conservative about business records (bookings, reviews, disputes stay) but
// aggressive about secrets and identity evidence. Nothing here is exposed as
// an admin API: the schedule is the only trigger.
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  async purge(now = new Date()) {
    const authCutoff = daysAgo(RETENTION.authArtifactDays);
    const readNotificationCutoff = daysAgo(RETENTION.readNotificationDays);
    const interactionCutoff = daysAgo(RETENTION.interactionDays);
    const verificationCutoff = daysAgo(RETENTION.verificationDocumentDays);
    const disputeCutoff = daysAgo(RETENTION.disputeEvidenceDays);
    const applicationCutoff = daysAgo(RETENTION.applicationPiiDays);

    const [resetTokens, refreshTokens, contactCodes] = await Promise.all([
      this.prisma.passwordResetToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: authCutoff } }, { usedAt: { lt: authCutoff } }] },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: authCutoff } }, { revokedAt: { lt: authCutoff } }] },
      }),
      this.prisma.contactVerificationCode.deleteMany({
        where: { OR: [{ expiresAt: { lt: authCutoff } }, { consumedAt: { lt: authCutoff } }] },
      }),
    ]);

    const [notifications, interactions, recommendationCache] = await Promise.all([
      this.prisma.notification.deleteMany({
        where: { readAt: { not: null, lt: readNotificationCutoff } },
      }),
      this.prisma.userInteraction.deleteMany({ where: { createdAt: { lt: interactionCutoff } } }),
      this.prisma.recommendationCache.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

    const verificationDocs = await this.prisma.verificationDocument.findMany({
      where: {
        verification: {
          OR: [
            { reviewedAt: { lt: verificationCutoff } },
            { expiresAt: { lt: verificationCutoff } },
          ],
        },
      },
      select: { id: true, storageKey: true },
      take: 500,
    });
    if (verificationDocs.length) {
      await this.prisma.verificationDocument.deleteMany({
        where: { id: { in: verificationDocs.map((doc) => doc.id) } },
      });
    }

    const disputeEvidence = await this.prisma.disputeEvidence.findMany({
      where: {
        createdAt: { lt: disputeCutoff },
        dispute: { status: { in: ['RESOLVED', 'REJECTED'] } },
      },
      select: { id: true, storageKey: true },
      take: 500,
    });
    if (disputeEvidence.length) {
      await this.prisma.disputeEvidence.deleteMany({
        where: { id: { in: disputeEvidence.map((evidence) => evidence.id) } },
      });
    }

    const applications = await this.prisma.providerApplication.updateMany({
      where: {
        status: { in: ['APPROVED', 'REJECTED'] },
        reviewedAt: { lt: applicationCutoff },
        OR: [
          { idNumber: { not: null } },
          { registrationNumber: { not: null } },
          { websiteUrl: { not: null } },
        ],
      },
      data: { idNumber: null, registrationNumber: null, websiteUrl: null },
    });

    const storageKeys = [...verificationDocs, ...disputeEvidence]
      .map((item) => item.storageKey)
      .filter(Boolean);
    for (const key of storageKeys) {
      try {
        await this.storage.delete(key);
      } catch (err) {
        this.logger.warn(`Could not delete retained object ${key}: ${(err as Error).message}`);
      }
    }

    const result = {
      resetTokens: resetTokens.count,
      refreshTokens: refreshTokens.count,
      contactCodes: contactCodes.count,
      notifications: notifications.count,
      interactions: interactions.count,
      recommendationCache: recommendationCache.count,
      verificationDocuments: verificationDocs.length,
      disputeEvidence: disputeEvidence.length,
      applicationPii: applications.count,
    };
    this.logger.log(`Retention purge completed: ${JSON.stringify(result)}`);
    return result;
  }
}
