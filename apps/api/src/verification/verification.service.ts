import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { ProviderContextService } from '../providers/provider-context.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import {
  ApproveVerificationDto,
  ReinstateVerificationDto,
  VerificationQueueQueryDto,
  VerificationReasonDto,
} from './dto/admin-verification.dto';
import {
  ACCEPTED_DOCUMENTS,
  DEFAULT_VALIDITY_MONTHS,
  EXPIRY_REMINDER_DAYS,
  PROVIDER_LEVEL_TYPES,
  RENEWAL_WINDOW_DAYS,
  REQUIRED_ANY_OF,
  SIGNED_URL_TTL_SECONDS,
  VERIFICATION_DOC_PREFIX,
  addDays,
  addMonths,
} from './verification.constants';
import { canTransition, computeProviderVerification, isLive } from './verification-status';
import { sniffMime } from './file-sniffer';
import { MAX_UPLOAD_BYTES } from '../files/storage.interface';

type Db = Prisma.TransactionClient | PrismaService;

const TYPE_LABEL: Record<VerificationType, string> = {
  IDENTITY: 'identity',
  BUSINESS: 'business',
  SERVICE: 'service',
};

// What providers (and admins) see for a record. Document storage keys are
// never returned — files are only reachable via admin signed URLs.
const RECORD_INCLUDE = {
  documents: {
    select: { id: true, documentType: true, mimeType: true, sizeBytes: true, originalName: true, createdAt: true },
  },
  serviceOffering: { select: { id: true, title: true, service: { select: { name: true } } } },
} satisfies Prisma.VerificationRecordInclude;

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditLog: AuditLogService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    private providerContext: ProviderContextService,
  ) {}

  // ---------------------------------------------------------------------
  // Derived badge state
  // ---------------------------------------------------------------------

  // Re-derives Provider.verificationStatus (+ flags/expiry) from the
  // provider's records and phone status. Every code path that changes a
  // record, or phone ownership, funnels through here.
  async recomputeProvider(db: Db, providerId: string, now = new Date()) {
    const provider = await db.provider.findUnique({
      where: { id: providerId },
      select: { id: true, user: { select: { phoneVerified: true } } },
    });
    if (!provider) return null;

    const records = await db.verificationRecord.findMany({
      where: { providerId, type: { in: PROVIDER_LEVEL_TYPES } },
      select: { type: true, status: true, expiresAt: true, updatedAt: true },
    });

    const state = computeProviderVerification(records, { phoneVerified: provider.user.phoneVerified, now });
    await db.provider.update({
      where: { id: providerId },
      data: {
        verificationStatus: state.status,
        identityVerified: state.identityVerified,
        businessVerified: state.businessVerified,
        verificationExpiresAt: state.expiresAt,
      },
    });
    return state;
  }

  async recomputeForUser(userId: string) {
    // Best-effort: this is called from flows where the caller isn't
    // necessarily sure the user still resolves to exactly one provider
    // (or a provider at all) — same "quietly do nothing" behavior as the
    // old `if (provider) ...` had for "no provider found", extended to
    // the new "more than one, ambiguous" case rather than letting either
    // throw out of a best-effort recompute.
    const provider = await this.providerContext.resolveForUser(userId).catch(() => null);
    if (provider) await this.recomputeProvider(this.prisma, provider.id);
  }

  // ---------------------------------------------------------------------
  // Provider side
  // ---------------------------------------------------------------------

  private async providerFor(userId: string) {
    // Was `prisma.provider.findUnique({ where: { userId } })`, which is a
    // PrismaClientValidationError at runtime now that Provider.userId isn't
    // @unique (manual-sql/010) — every call here 500'd. ProviderContextService
    // is the documented replacement: it resolves through WorkspaceMembership,
    // which also covers a workspace the user was *invited* into.
    const resolved = await this.providerContext.resolveForUser(userId).catch(() => null);
    if (!resolved) throw new ForbiddenException('Provider profile not found');

    return this.prisma.provider.findUniqueOrThrow({
      where: { id: resolved.id },
      include: { user: { select: { emailVerified: true, phoneVerified: true, phone: true } } },
    });
  }

  // Uploads one document PRIVATELY and returns the key to reference it in
  // a submission. The key is namespaced by provider id, and submit()
  // refuses keys outside that namespace, so one provider can never attach
  // another's file.
  async uploadDocument(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File is too large (max 8 MB)');
    const mime = sniffMime(file.buffer);
    if (!mime) throw new BadRequestException('Only JPEG, PNG, WEBP images or PDF files are allowed');

    const provider = await this.providerFor(userId);
    const { key } = await this.storage.uploadPrivate(
      file.buffer,
      file.originalname,
      mime,
      `${VERIFICATION_DOC_PREFIX}/${provider.id}`,
    );
    return { storageKey: key, mimeType: mime, sizeBytes: file.size, originalName: file.originalname.slice(0, 200) };
  }

  async submit(userId: string, dto: SubmitVerificationDto, now = new Date()) {
    const provider = await this.providerFor(userId);

    // What is being verified
    if (dto.type === 'SERVICE') {
      if (!dto.serviceOfferingId) throw new BadRequestException('serviceOfferingId is required for a service verification');
      const offering = await this.prisma.serviceOffering.findUnique({ where: { id: dto.serviceOfferingId } });
      if (!offering || offering.providerId !== provider.id) throw new NotFoundException('Service offering not found');
    } else if (dto.serviceOfferingId) {
      throw new BadRequestException('serviceOfferingId is only valid for a service verification');
    }
    const offeringId = dto.type === 'SERVICE' ? dto.serviceOfferingId! : null;

    // Documents
    const accepted = ACCEPTED_DOCUMENTS[dto.type];
    const ownPrefix = `${VERIFICATION_DOC_PREFIX}/${provider.id}/`;
    const seen = new Set<string>();
    for (const d of dto.documents) {
      if (!accepted.includes(d.documentType)) {
        throw new BadRequestException(`${d.documentType} is not accepted for a ${TYPE_LABEL[dto.type]} verification`);
      }
      if (!d.storageKey.startsWith(ownPrefix) || d.storageKey.includes('..')) {
        throw new BadRequestException('Invalid document reference');
      }
      if (seen.has(d.storageKey)) throw new BadRequestException('The same document was attached twice');
      seen.add(d.storageKey);
    }
    if (!dto.documents.some((d) => REQUIRED_ANY_OF[dto.type].includes(d.documentType))) {
      throw new BadRequestException(
        `Attach at least one of: ${REQUIRED_ANY_OF[dto.type].map((t) => t.replace(/_/g, ' ').toLowerCase()).join(', ')}`,
      );
    }

    // Trust the storage layer, not the client, for file metadata — and make
    // sure every referenced file was really uploaded.
    const stats = await Promise.all(dto.documents.map((d) => this.storage.statObject(d.storageKey)));
    if (stats.some((s) => !s)) throw new BadRequestException('One or more documents were not found. Upload them again.');

    // Rules about what's already on file
    const existing = await this.prisma.verificationRecord.findMany({
      where: { providerId: provider.id, type: dto.type, serviceOfferingId: offeringId },
      select: { status: true, expiresAt: true },
    });
    if (existing.some((r) => r.status === 'SUSPENDED')) {
      throw new ForbiddenException('This verification is suspended. Please contact support.');
    }
    if (existing.some((r) => r.status === 'PENDING')) {
      throw new ConflictException('You already have a submission under review.');
    }
    const live = existing.find((r) => isLive(r, now));
    if (live?.expiresAt && live.expiresAt.getTime() - now.getTime() > RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
      throw new ConflictException('This is already verified. You can renew it within 30 days of expiry.');
    }

    let created;
    try {
      created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const record = await tx.verificationRecord.create({
          data: {
            providerId: provider.id,
            type: dto.type,
            serviceOfferingId: offeringId,
            legalName: dto.legalName,
            referenceNumber: dto.referenceNumber,
            submitterNote: dto.note,
            documents: {
              create: dto.documents.map((d, i) => ({
                documentType: d.documentType,
                storageKey: d.storageKey,
                mimeType: stats[i]!.mimeType,
                sizeBytes: stats[i]!.sizeBytes,
              })),
            },
          },
          include: RECORD_INCLUDE,
        });
        await this.recomputeProvider(tx, provider.id, now);
        return record;
      });
    } catch (err) {
      // Partial unique index: one PENDING record per (provider, type, offering)
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You already have a submission under review.');
      }
      throw err;
    }
    return created;
  }

  // Everything the provider's verification screen needs in one call.
  async myStatus(userId: string, now = new Date()) {
    const provider = await this.providerFor(userId);
    const [records, offerings] = await Promise.all([
      this.prisma.verificationRecord.findMany({
        where: { providerId: provider.id },
        include: RECORD_INCLUDE,
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.serviceOffering.findMany({
        where: { providerId: provider.id, isActive: true },
        select: { id: true, title: true, service: { select: { name: true } } },
      }),
    ]);

    const renewalCutoff = addDays(now, RENEWAL_WINDOW_DAYS);
    const nextSteps: string[] = [];
    if (!provider.user.phone) nextSteps.push('ADD_PHONE');
    else if (!provider.user.phoneVerified) nextSteps.push('VERIFY_PHONE');
    if (!provider.user.emailVerified) nextSteps.push('VERIFY_EMAIL');
    const forType = (t: VerificationType) => records.filter((r) => r.type === t && r.serviceOfferingId === null);
    const identity = forType('IDENTITY');
    if (!identity.some((r) => r.status === 'PENDING' || r.status === 'SUSPENDED' || isLive(r, now))) {
      nextSteps.push('SUBMIT_IDENTITY');
    } else if (identity.some((r) => isLive(r, now) && r.expiresAt && r.expiresAt <= renewalCutoff) && !identity.some((r) => r.status === 'PENDING')) {
      nextSteps.push('RENEW_IDENTITY');
    }

    return {
      status: provider.verificationStatus,
      identityVerified: provider.identityVerified,
      businessVerified: provider.businessVerified,
      expiresAt: provider.verificationExpiresAt,
      phoneVerified: provider.user.phoneVerified,
      emailVerified: provider.user.emailVerified,
      hasPhone: !!(provider.user?.phone || provider.phone),
      nextSteps,
      records: records.map((r) => this.toProviderView(r, now)),
      offerings: offerings.map((o) => ({ id: o.id, name: o.title || o.service.name })),
    };
  }

  private toProviderView(r: any, now: Date) {
    return {
      id: r.id,
      type: r.type,
      status: r.status as VerificationStatus,
      offering: r.serviceOffering ? { id: r.serviceOffering.id, name: r.serviceOffering.title || r.serviceOffering.service.name } : null,
      legalName: r.legalName,
      referenceNumber: r.referenceNumber,
      decisionNote: r.status === 'REJECTED' || r.status === 'SUSPENDED' ? r.decisionNote : null,
      submittedAt: r.submittedAt,
      verifiedAt: r.verifiedAt,
      expiresAt: r.expiresAt,
      expiringSoon: isLive(r, now) && !!r.expiresAt && r.expiresAt <= addDays(now, EXPIRY_REMINDER_DAYS),
      documents: r.documents,
    };
  }

  // ---------------------------------------------------------------------
  // Admin workflow
  // ---------------------------------------------------------------------

  async queue(query: VerificationQueueQueryDto) {
    const page = Number(query.page) || 1;
    const limit = 20;
    const where: Prisma.VerificationRecordWhereInput = {
      status: query.status ?? 'PENDING',
      ...(query.type ? { type: query.type } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.verificationRecord.findMany({
        where,
        // oldest first: the queue is worked in submission order
        orderBy: { submittedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ...RECORD_INCLUDE,
          provider: {
            select: { id: true, businessName: true, user: { select: { firstName: true, lastName: true, phoneVerified: true, emailVerified: true } } },
          },
        },
      }),
      this.prisma.verificationRecord.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // Opening a record for review hands out short-lived signed links to the
  // private documents, so every open is written to the audit trail.
  async getForReview(id: string, adminId: string) {
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id },
      include: {
        documents: true,
        serviceOffering: { select: { id: true, title: true, service: { select: { name: true } } } },
        provider: {
          select: {
            id: true,
            businessName: true,
            verificationStatus: true,
            user: { select: { firstName: true, lastName: true, email: true, phone: true, phoneVerified: true, emailVerified: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Verification record not found');

    const [documents, history, openReports] = await Promise.all([
      Promise.all(
        record.documents.map(async (d) => ({
          id: d.id,
          documentType: d.documentType,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          url: await this.storage.getSignedUrl(d.storageKey, SIGNED_URL_TTL_SECONDS),
        })),
      ),
      this.prisma.verificationRecord.findMany({
        where: { providerId: record.providerId, id: { not: id } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: { id: true, type: true, status: true, submittedAt: true, expiresAt: true, decisionNote: true },
      }),
      this.prisma.report.count({
        where: { targetType: 'PROVIDER', targetId: record.providerId, resolvedAt: null },
      }),
    ]);

    await this.auditLog.log(adminId, 'VERIFICATION_DOCUMENTS_VIEWED', 'VerificationRecord', id, {
      providerId: record.providerId,
      documentCount: documents.length,
    });

    return { ...record, documents, documentLinksExpireInSeconds: SIGNED_URL_TTL_SECONDS, history, openReports };
  }

  private async loadForDecision(id: string) {
    const record = await this.prisma.verificationRecord.findUnique({
      where: { id },
      include: { provider: { select: { id: true, userId: true } } },
    });
    if (!record) throw new NotFoundException('Verification record not found');
    return record;
  }

  private assertTransition(from: VerificationStatus, to: VerificationStatus) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(`A ${from.toLowerCase()} verification cannot be changed to ${to.toLowerCase()}`);
    }
  }

  async approve(id: string, adminId: string, dto: ApproveVerificationDto, now = new Date()) {
    const record = await this.loadForDecision(id);
    this.assertTransition(record.status, 'VERIFIED');
    const expiresAt = addMonths(now, dto.validityMonths ?? DEFAULT_VALIDITY_MONTHS);

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Renewal: retire whatever this replaces so there's one live record per subject.
      await tx.verificationRecord.updateMany({
        where: {
          providerId: record.providerId,
          type: record.type,
          serviceOfferingId: record.serviceOfferingId,
          status: 'VERIFIED',
          id: { not: id },
        },
        data: { status: 'EXPIRED', decisionNote: 'Replaced by a renewed verification', reviewedAt: now },
      });
      const r = await tx.verificationRecord.update({
        where: { id },
        data: {
          status: 'VERIFIED',
          verifiedAt: now,
          expiresAt,
          reviewedAt: now,
          reviewedById: adminId,
          decisionNote: dto.note ?? null,
          expiryReminderSentAt: null,
        },
      });
      await this.recomputeProvider(tx, record.providerId, now);
      return r;
    });

    await this.auditLog.log(adminId, 'VERIFICATION_APPROVED', 'VerificationRecord', id, {
      providerId: record.providerId,
      type: record.type,
      expiresAt: expiresAt.toISOString(),
    });
    await this.notifyProvider(record.provider.userId, record.type, `Your ${TYPE_LABEL[record.type]} verification was approved`, `Valid until ${expiresAt.toISOString().slice(0, 10)}.`, id);
    return updated;
  }

  async reject(id: string, adminId: string, dto: VerificationReasonDto, now = new Date()) {
    const record = await this.loadForDecision(id);
    this.assertTransition(record.status, 'REJECTED');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.verificationRecord.update({
        where: { id },
        data: { status: 'REJECTED', reviewedAt: now, reviewedById: adminId, decisionNote: dto.reason },
      });
      await this.recomputeProvider(tx, record.providerId, now);
      return r;
    });

    await this.auditLog.log(adminId, 'VERIFICATION_REJECTED', 'VerificationRecord', id, {
      providerId: record.providerId,
      type: record.type,
      reason: dto.reason,
    });
    await this.notifyProvider(record.provider.userId, record.type, `Your ${TYPE_LABEL[record.type]} verification was not approved`, dto.reason, id);
    return updated;
  }

  // Pulls a badge that was granted — e.g. a document turned out to be
  // forged. A SUSPENDED identity/business record also hides the provider
  // from search (see PostgresProviderSearchService).
  async suspend(id: string, adminId: string, dto: VerificationReasonDto, now = new Date()) {
    const record = await this.loadForDecision(id);
    this.assertTransition(record.status, 'SUSPENDED');

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.verificationRecord.update({
        where: { id },
        data: { status: 'SUSPENDED', reviewedAt: now, reviewedById: adminId, decisionNote: dto.reason },
      });
      await this.recomputeProvider(tx, record.providerId, now);
      return r;
    });

    await this.auditLog.log(adminId, 'VERIFICATION_SUSPENDED', 'VerificationRecord', id, {
      providerId: record.providerId,
      type: record.type,
      reason: dto.reason,
    });
    await this.notifyProvider(record.provider.userId, record.type, `Your ${TYPE_LABEL[record.type]} verification was suspended`, dto.reason, id);
    return updated;
  }

  async reinstate(id: string, adminId: string, dto: ReinstateVerificationDto, now = new Date()) {
    const record = await this.loadForDecision(id);
    if (record.status !== 'SUSPENDED') throw new BadRequestException('Only a suspended verification can be reinstated');
    // Suspension doesn't stop the clock: if it ran out meanwhile, it lapses instead.
    const stillValid = !record.expiresAt || record.expiresAt.getTime() > now.getTime();
    const target: VerificationStatus = stillValid ? 'VERIFIED' : 'EXPIRED';
    this.assertTransition(record.status, target);

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.verificationRecord.update({
        where: { id },
        data: { status: target, reviewedAt: now, reviewedById: adminId, decisionNote: dto.note ?? null },
      });
      await this.recomputeProvider(tx, record.providerId, now);
      return r;
    });

    await this.auditLog.log(adminId, 'VERIFICATION_REINSTATED', 'VerificationRecord', id, {
      providerId: record.providerId,
      type: record.type,
      result: target,
    });
    await this.notifyProvider(
      record.provider.userId,
      record.type,
      stillValid ? `Your ${TYPE_LABEL[record.type]} verification was reinstated` : `Your ${TYPE_LABEL[record.type]} verification has expired`,
      undefined,
      id,
    );
    return updated;
  }

  // ---------------------------------------------------------------------
  // Expiry (run daily by VerificationSweepProcessor; also callable by an admin)
  // ---------------------------------------------------------------------

  async sweepExpired(now = new Date()) {
    const due = await this.prisma.verificationRecord.findMany({
      where: { status: 'VERIFIED', expiresAt: { lte: now } },
      include: { provider: { select: { userId: true } } },
    });

    let expired = 0;
    for (const record of due) {
      const changed = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // updateMany + status guard = idempotent if two sweeps overlap
        const res = await tx.verificationRecord.updateMany({
          where: { id: record.id, status: 'VERIFIED' },
          data: { status: 'EXPIRED', decisionNote: 'Verification period ended', reviewedAt: now },
        });
        if (res.count > 0) await this.recomputeProvider(tx, record.providerId, now);
        return res.count > 0;
      });
      if (changed) {
        expired++;
        await this.notifyProvider(
          record.provider.userId,
          record.type,
          `Your ${TYPE_LABEL[record.type]} verification has expired`,
          'Submit your documents again to get your badge back.',
          record.id,
        );
      }
    }

    const soon = await this.prisma.verificationRecord.findMany({
      where: {
        status: 'VERIFIED',
        expiresAt: { gt: now, lte: addDays(now, EXPIRY_REMINDER_DAYS) },
        expiryReminderSentAt: null,
      },
      include: { provider: { select: { userId: true } } },
    });
    let reminded = 0;
    for (const record of soon) {
      const res = await this.prisma.verificationRecord.updateMany({
        where: { id: record.id, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: now },
      });
      if (res.count === 0) continue;
      reminded++;
      await this.notifications.notify({
        userId: record.provider.userId,
        type: 'VERIFICATION_EXPIRING',
        title: `Your ${TYPE_LABEL[record.type]} verification expires soon`,
        body: `It ends on ${record.expiresAt!.toISOString().slice(0, 10)}. Renew it to keep your badge.`,
        data: { verificationId: record.id },
      });
    }

    this.logger.log(`Verification sweep: ${expired} expired, ${reminded} reminders sent`);
    return { expired, reminded };
  }

  private async notifyProvider(userId: string, type: VerificationType, title: string, body: string | undefined, verificationId: string) {
    await this.notifications.notify({
      userId,
      type: 'VERIFICATION_UPDATED',
      title,
      body,
      data: { verificationId, verificationType: type },
    });
  }
}
