import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppealStatus,
  FraudReportStatus,
  Prisma,
  RestrictionType,
  RiskAssessmentStatus,
  SecurityEventType,
  VerificationCheckType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import {
  CreateFraudReportDto,
  CreateProviderFraudReportDto,
  CreateProviderVerificationCheckDto,
  CreateRestrictionDto,
  ListAppealsDto,
  ListTrustRecordsDto,
} from './dto/trust-safety.dto';
import { RiskContribution, RiskScoringService } from './risk-scoring.service';

const DEFAULT_RULES = [
  { code: 'repeated_registration_attempts', name: 'Repeated registration attempts', description: 'Repeated registrations observed in a configured window.', points: 10, enabled: true, windowHours: 24 },
  { code: 'identity_information_changes', name: 'Repeated identity information changes', description: 'Repeated changes to identity information.', points: 10, enabled: true, windowHours: 168 },
  { code: 'possible_duplicate_identity', name: 'Possible duplicate identity', description: 'An administrator or verification process marked a possible duplicate.', points: 25, enabled: true, windowHours: 720 },
  { code: 'multiple_credible_reports', name: 'Multiple escalated reports', description: 'At least three reports were escalated for human investigation.', points: 20, enabled: true, windowHours: 720 },
  { code: 'document_inconsistency', name: 'Document information inconsistency', description: 'A provider verification check recorded inconsistent document details.', points: 15, enabled: true, windowHours: 720 },
  { code: 'suspicious_review_manipulation', name: 'Suspicious review manipulation', description: 'An administrator recorded suspicious review activity.', points: 15, enabled: true, windowHours: 720 },
  { code: 'confirmed_forged_document', name: 'Confirmed forged document evidence', description: 'An authorized administrator confirmed forged document evidence.', points: 50, enabled: true, windowHours: 720 },
  { code: 'shared_verification_document', name: 'Verification document reused by another account', description: 'The same verification document was found on more than one provider account.', points: 40, enabled: true, windowHours: 720 },
  { code: 'duplicate_provider_identity', name: 'Duplicate provider identity', description: 'Registration or legal identity details match another provider account.', points: 30, enabled: true, windowHours: 720 },
  { code: 'duplicate_business_name', name: 'Duplicate provider business name', description: 'A provider business name matches another provider account.', points: 15, enabled: true, windowHours: 720 },
  { code: 'public_contact_details', name: 'Direct contact details in public profile', description: 'Public provider text exposes an email address, phone number, or external URL.', points: 15, enabled: true, windowHours: 720 },
  { code: 'unverified_contact_activity', name: 'Unverified account quoting clients', description: 'A provider with unverified email or phone ownership is already quoting clients.', points: 20, enabled: true, windowHours: 720 },
] as const;

type AutomatedScreeningEvidence = {
  signals?: Array<{ code?: unknown; reason?: unknown }>;
};

const OPEN_REPORT_STATUSES: FraudReportStatus[] = [
  FraudReportStatus.PENDING,
  FraudReportStatus.UNDER_INVESTIGATION,
  FraudReportStatus.ADDITIONAL_INFORMATION_REQUIRED,
  FraudReportStatus.ESCALATED,
];

@Injectable()
export class TrustSafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly scoring: RiskScoringService,
  ) {}

  async recordEvent(userId: string, eventType: SecurityEventType, dedupeKey?: string) {
    if (dedupeKey && !/^[a-zA-Z0-9._:-]{1,100}$/.test(dedupeKey)) {
      throw new BadRequestException('Invalid deduplication key');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.securityEvent.create({
          data: { userId, eventType, dedupeKey },
        });
        await this.createAssessment(tx, userId, event.id);
        return { accepted: true, eventId: event.id };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dedupeKey
      ) {
        const existing = await this.prisma.securityEvent.findUnique({
          where: { dedupeKey },
        });
        if (existing?.userId === userId && existing.eventType === eventType) {
          return { accepted: false, eventId: existing.id };
        }
        throw new ConflictException('Deduplication key has already been used');
      }
      throw error;
    }
  }

  async createReport(reporterId: string, dto: CreateFraudReportDto) {
    if (reporterId === dto.reportedUserId) {
      throw new BadRequestException('You cannot report your own account');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.reportedUserId },
      select: { id: true, role: true, providers: { select: { id: true }, take: 1 } },
    });
    if (!target) throw new NotFoundException('Reported account not found');

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReports = await this.prisma.fraudReport.count({
      where: { reporterId, createdAt: { gte: since } },
    });
    if (recentReports >= 5) throw new ForbiddenException('Daily report limit reached');

    const duplicate = await this.prisma.fraudReport.findFirst({
      where: {
        reporterId,
        reportedUserId: dto.reportedUserId,
        category: dto.category,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('You have already submitted this report recently');

    let providerId = target.providers[0]?.id;
    if (dto.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: dto.bookingId },
        select: {
          client: { select: { userId: true } },
          provider: { select: { id: true, userId: true } },
        },
      });
      if (!booking) throw new NotFoundException('Related booking not found');
      const participants = [booking.client.userId, booking.provider.userId];
      if (!participants.includes(reporterId) || !participants.includes(dto.reportedUserId)) {
        throw new ForbiddenException('A related booking must involve both accounts');
      }
      providerId = booking.provider.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const report = await tx.fraudReport.create({
        data: {
          reporterId,
          reportedUserId: dto.reportedUserId,
          providerId,
          bookingId: dto.bookingId,
          category: dto.category,
          description: dto.description.trim(),
        },
      });
      await tx.securityEvent.create({
        data: {
          userId: reporterId,
          eventType: SecurityEventType.FRAUD_REPORT_SUBMITTED,
          dedupeKey: `fraud-report:${report.id}`,
        },
      });
      return report;
    });
  }

  async createProviderReport(reporterId: string, providerId: string, dto: CreateProviderFraudReportDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, userId: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.createReport(reporterId, { ...dto, reportedUserId: provider.userId });
  }

  async reportsFiledBy(userId: string) {
    return this.prisma.fraudReport.findMany({
      where: { reporterId: userId },
      select: {
        id: true,
        category: true,
        description: true,
        status: true,
        resolution: true,
        createdAt: true,
        resolvedAt: true,
        reportedUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async myRestrictions(userId: string) {
    await this.prisma.accountRestriction.updateMany({
      where: { userId, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return this.prisma.accountRestriction.findMany({
      where: { userId },
      include: {
        appeals: { where: { userId }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async appealRestriction(userId: string, restrictionId: string, reason: string) {
    const restriction = await this.prisma.accountRestriction.findUnique({
      where: { id: restrictionId },
      select: { id: true, userId: true, status: true },
    });
    if (!restriction || restriction.userId !== userId) {
      throw new NotFoundException('Restriction not found');
    }
    if (restriction.status !== 'ACTIVE') throw new ConflictException('Only active restrictions can be appealed');

    const existing = await this.prisma.restrictionAppeal.findFirst({
      where: { restrictionId, userId, status: AppealStatus.PENDING },
      select: { id: true },
    });
    if (existing) throw new ConflictException('An appeal is already pending for this restriction');
    return this.prisma.restrictionAppeal.create({
      data: { restrictionId, userId, reason: reason.trim() },
    });
  }

  async overview() {
    const [
      totalUsers,
      pendingProviderApplications,
      pendingProviderVerifications,
      flaggedAccounts,
      highRiskInvestigations,
      openReports,
      confirmedCases,
      recentEvents,
    ] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
        this.prisma.providerApplication.count({ where: { status: 'PENDING' } }),
        this.prisma.verificationRecord.count({ where: { status: 'PENDING' } }),
        this.prisma.user.count({
          where: {
            riskAssessments: {
              some: { riskScore: { gte: 25 }, assessmentStatus: RiskAssessmentStatus.PENDING },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            riskAssessments: {
              some: {
                riskLevel: { in: ['HIGH', 'CRITICAL'] },
                assessmentStatus: RiskAssessmentStatus.PENDING,
              },
            },
          },
        }),
        this.prisma.fraudReport.count({ where: { status: { in: OPEN_REPORT_STATUSES } } }),
        this.prisma.user.count({
          where: { riskAssessments: { some: { assessmentStatus: RiskAssessmentStatus.CONFIRMED } } },
        }),
        this.prisma.securityEvent.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { id: true, userId: true, eventType: true, createdAt: true },
        }),
      ]);
    return {
      totalUsers,
      pendingProviderApplications,
      pendingProviderVerifications,
      flaggedAccounts,
      highRiskInvestigations,
      openReports,
      confirmedCases,
      recentEvents,
    };
  }

  async flaggedAccounts(query: ListTrustRecordsDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: {
          role: { not: 'ADMIN' },
          riskAssessments: {
            some: {
              riskScore: { gte: 25 },
              assessmentStatus: RiskAssessmentStatus.PENDING,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          riskAssessments: {
            where: { riskScore: { gte: 25 }, assessmentStatus: RiskAssessmentStatus.PENDING },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { indicators: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({
        where: {
          role: { not: 'ADMIN' },
          riskAssessments: {
            some: {
              riskScore: { gte: 25 },
              assessmentStatus: RiskAssessmentStatus.PENDING,
            },
          },
        },
      }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async accountDetails(userId: string) {
    await this.prisma.accountRestriction.updateMany({
      where: { userId, status: 'ACTIVE', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        providers: {
          select: {
            id: true,
            businessName: true,
            verificationStatus: true,
            identityVerified: true,
            businessVerified: true,
            verificationChecks: { orderBy: { createdAt: 'desc' }, take: 20 },
            reviews: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: { id: true, rating: true, comment: true, createdAt: true },
            },
            bookings: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: { id: true, status: true, createdAt: true, review: { select: { rating: true, comment: true } } },
            },
          },
        },
        clientProfile: {
          select: {
            bookings: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                status: true,
                createdAt: true,
                provider: { select: { id: true, businessName: true } },
                review: { select: { rating: true, comment: true } },
              },
            },
          },
        },
        riskAssessments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { indicators: true, reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
        },
        fraudReportsAgainst: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, category: true, status: true, priority: true, createdAt: true, resolution: true },
        },
        accountRestrictions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  async reassess(userId: string, adminId?: string) {
    if (!(await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }))) {
      throw new NotFoundException('Account not found');
    }
    return this.prisma.$transaction(async (tx) => {
      const assessment = await this.createAssessment(tx, userId);
      if (adminId) {
        await tx.auditLog.create({
          data: {
            actorId: adminId,
            action: 'TRUST_ASSESSMENT_REASSESSED',
            entity: 'RiskAssessment',
            entityId: assessment.id,
            metadata: { userId },
          },
        });
      }
      return assessment;
    });
  }

  async assessment(assessmentId: string) {
    const result = await this.prisma.riskAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
        indicators: true,
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!result) throw new NotFoundException('Risk assessment not found');
    return result;
  }

  async reviewAssessment(adminId: string, assessmentId: string, status: RiskAssessmentStatus, note: string) {
    const assessment = await this.prisma.riskAssessment.findUnique({ where: { id: assessmentId } });
    if (!assessment) throw new NotFoundException('Risk assessment not found');
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.riskAssessment.update({
        where: { id: assessmentId },
        data: { assessmentStatus: status, reviewedById: adminId, reviewedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'TRUST_ASSESSMENT_REVIEWED',
          entity: 'RiskAssessment',
          entityId: assessmentId,
          metadata: { status, note, userId: assessment.userId },
        },
      });
      return result;
    });
    return updated;
  }

  async recordProviderCheck(adminId: string, userId: string, dto: CreateProviderVerificationCheckDto) {
    const provider = await this.prisma.provider.findFirst({
      where: { id: dto.providerId, userId },
      select: { id: true },
    });
    if (!provider) throw new NotFoundException('Provider profile not found for this account');

    return this.prisma.$transaction(async (tx) => {
      const check = await tx.providerVerificationCheck.create({
        data: {
          providerId: provider.id,
          checkType: dto.checkType,
          status: dto.status,
          details: dto.details?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'PROVIDER_VERIFICATION_CHECK_RECORDED',
          entity: 'ProviderVerificationCheck',
          entityId: check.id,
          metadata: { userId, providerId: provider.id, checkType: dto.checkType, status: dto.status },
        },
      });
      await this.createAssessment(tx, userId);
      return check;
    });
  }

  async reports(query: ListTrustRecordsDto) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.fraudReport.findMany({
        where,
        include: {
          reporter: { select: { id: true, firstName: true, lastName: true } },
          reportedUser: { select: { id: true, firstName: true, lastName: true, role: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.fraudReport.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async updateReport(adminId: string, reportId: string, status: FraudReportStatus, resolution?: string) {
    const report = await this.prisma.fraudReport.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Fraud report not found');
    if ((status === FraudReportStatus.RESOLVED || status === FraudReportStatus.DISMISSED) && !resolution?.trim()) {
      throw new BadRequestException('A resolution note is required');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fraudReport.update({
        where: { id: reportId },
        data: {
          status,
          resolution: resolution?.trim() || null,
          resolvedAt: status === FraudReportStatus.RESOLVED || status === FraudReportStatus.DISMISSED ? new Date() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'FRAUD_REPORT_UPDATED',
          entity: 'FraudReport',
          entityId: reportId,
          metadata: { previousStatus: report.status, status, targetUserId: report.reportedUserId },
        },
      });
      if (status === FraudReportStatus.ESCALATED && report.status !== FraudReportStatus.ESCALATED) {
        await this.createAssessment(tx, report.reportedUserId);
      }
      return updated;
    });
  }

  async createRestriction(adminId: string, dto: CreateRestrictionDto) {
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.restrictionType === RestrictionType.TEMPORARY_SUSPENSION && (!expiresAt || expiresAt <= new Date())) {
      throw new BadRequestException('A temporary suspension requires a future expiry date');
    }
    if (dto.restrictionType === RestrictionType.PERMANENT_SUSPENSION && expiresAt) {
      throw new BadRequestException('A permanent suspension cannot have an expiry date');
    }
    if (!(await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } }))) {
      throw new NotFoundException('Account not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const restriction = await tx.accountRestriction.create({
        data: {
          userId: dto.userId,
          issuedById: adminId,
          restrictionType: dto.restrictionType,
          reason: dto.reason.trim(),
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ACCOUNT_RESTRICTION_CREATED',
          entity: 'AccountRestriction',
          entityId: restriction.id,
          metadata: { userId: dto.userId, restrictionType: dto.restrictionType, reason: dto.reason.trim() },
        },
      });
      return restriction;
    });
  }

  async liftRestriction(adminId: string, restrictionId: string, reason: string) {
    const current = await this.prisma.accountRestriction.findUnique({ where: { id: restrictionId } });
    if (!current) throw new NotFoundException('Restriction not found');
    if (current.status !== 'ACTIVE') throw new ConflictException('Restriction is not active');

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.accountRestriction.updateMany({
        where: { id: restrictionId, status: 'ACTIVE' },
        data: { status: 'LIFTED', liftedAt: new Date(), liftedById: adminId },
      });
      if (changed.count !== 1) throw new ConflictException('Restriction has already been lifted');

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ACCOUNT_RESTRICTION_LIFTED',
          entity: 'AccountRestriction',
          entityId: restrictionId,
          metadata: { userId: current.userId, reason: reason.trim() },
        },
      });
      return tx.accountRestriction.findUniqueOrThrow({ where: { id: restrictionId } });
    });
  }

  async listAppeals(query: ListAppealsDto) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.restrictionAppeal.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          restriction: { select: { id: true, restrictionType: true, reason: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.restrictionAppeal.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async reviewAppeal(adminId: string, appealId: string, status: AppealStatus, decisionNote: string) {
    const appeal = await this.prisma.restrictionAppeal.findUnique({ where: { id: appealId } });
    if (!appeal) throw new NotFoundException('Appeal not found');
    if (appeal.status !== AppealStatus.PENDING) throw new ConflictException('Appeal has already been reviewed');
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.restrictionAppeal.update({
        where: { id: appealId },
        data: { status, reviewedById: adminId, reviewedAt: new Date(), decisionNote: decisionNote.trim() },
      });
      if (status === AppealStatus.APPROVED) {
        await tx.accountRestriction.updateMany({
          where: { id: appeal.restrictionId, status: 'ACTIVE' },
          data: { status: 'LIFTED', liftedAt: new Date(), liftedById: adminId },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'RESTRICTION_APPEAL_REVIEWED',
          entity: 'RestrictionAppeal',
          entityId: appealId,
          metadata: { status, decisionNote: decisionNote.trim(), userId: appeal.userId },
        },
      });
      return result;
    });
  }

  async auditLogs(query: ListTrustRecordsDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where: { entity: { in: ['RiskAssessment', 'FraudReport', 'AccountRestriction', 'RestrictionAppeal'] } },
        include: { actor: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({
        where: { entity: { in: ['RiskAssessment', 'FraudReport', 'AccountRestriction', 'RestrictionAppeal'] } },
      }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async rules() {
    const stored = await this.prisma.fraudRule.findMany({ orderBy: { code: 'asc' } });
    const byCode = new Map<string, (typeof DEFAULT_RULES)[number] | (typeof stored)[number]>();
    for (const rule of DEFAULT_RULES) byCode.set(rule.code, rule);
    for (const rule of stored) byCode.set(rule.code, rule);
    return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }

  async updateRule(adminId: string, code: string, changes: { points?: number; enabled?: boolean; windowHours?: number }) {
    const defaultRule = DEFAULT_RULES.find((rule) => rule.code === code);
    if (!defaultRule) throw new NotFoundException('Fraud rule not found');
    const current = await this.prisma.fraudRule.findUnique({ where: { code } });
    const updated = await this.prisma.fraudRule.upsert({
      where: { code },
      create: {
        code,
        name: defaultRule.name,
        description: defaultRule.description,
        points: changes.points ?? defaultRule.points,
        enabled: changes.enabled ?? defaultRule.enabled,
        windowHours: changes.windowHours ?? defaultRule.windowHours,
        version: 1,
      },
      update: {
        ...changes,
        version: { increment: 1 },
      },
    });
    await this.auditLog.log(adminId, 'FRAUD_RULE_UPDATED', 'FraudRule', updated.id, {
      code,
      previousVersion: current?.version ?? 0,
      version: updated.version,
    });
    return updated;
  }

  private async createAssessment(
    tx: Prisma.TransactionClient,
    userId: string,
    sourceEventId?: string,
  ) {
    const rules = await tx.fraudRule.findMany();
    const ruleByCode = new Map<string, { points: number; enabled: boolean; windowHours: number | null }>();
    for (const rule of DEFAULT_RULES) ruleByCode.set(rule.code, rule);
    for (const rule of rules) ruleByCode.set(rule.code, rule);
    const now = new Date();
    const [providerChecks, automatedChecks] = await Promise.all([
      tx.providerVerificationCheck.findMany({
        where: {
          provider: { userId },
          status: { in: ['WARNING', 'FAIL'] },
          checkType: { not: VerificationCheckType.AUTOMATED_FRAUD_SCREENING },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, checkType: true, status: true, createdAt: true },
      }),
      tx.providerVerificationCheck.findMany({
        where: {
          provider: { userId },
          checkType: VerificationCheckType.AUTOMATED_FRAUD_SCREENING,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          providerId: true,
          status: true,
          createdAt: true,
          evidence: true,
        },
      }),
    ]);
    const contributions: RiskContribution[] = [];
    const addRule = (code: string, reason: string, reference?: string, observedAt?: Date) => {
      const rule = ruleByCode.get(code);
      if (!rule?.enabled) return;
      const cutoff = rule.windowHours ? now.getTime() - rule.windowHours * 60 * 60 * 1000 : 0;
      if (cutoff && observedAt && observedAt.getTime() < cutoff) {
        return;
      }
      contributions.push({
        code,
        severity: rule.points >= 50 ? 'CRITICAL' : rule.points >= 25 ? 'HIGH' : 'MODERATE',
        points: rule.points,
        reason,
        ...(reference ? { evidenceReference: reference } : {}),
      });
    };

    const duplicateCheck = providerChecks.find((check) => check.checkType === 'DUPLICATE_IDENTITY');
    if (duplicateCheck) addRule('possible_duplicate_identity', 'Possible duplicate identity flagged in a provider verification check.', duplicateCheck.id, duplicateCheck.createdAt);
    const inconsistencyCheck = providerChecks.find((check) =>
      ['IDENTITY_CONSISTENCY', 'BUSINESS_CONSISTENCY', 'DOCUMENT_AUTHENTICITY'].includes(check.checkType),
    );
    if (inconsistencyCheck) addRule('document_inconsistency', 'A provider verification check recorded information inconsistency.', inconsistencyCheck.id, inconsistencyCheck.createdAt);

    const latestAutomatedChecks = new Map<string, (typeof automatedChecks)[number]>();
    for (const check of automatedChecks) {
      if (!latestAutomatedChecks.has(check.providerId)) {
        latestAutomatedChecks.set(check.providerId, check);
      }
    }
    for (const check of latestAutomatedChecks.values()) {
      if (check.status !== 'WARNING' && check.status !== 'FAIL') continue;
      const evidence = check.evidence as unknown as AutomatedScreeningEvidence | null;
      for (const signal of evidence?.signals ?? []) {
        if (typeof signal.code !== 'string' || typeof signal.reason !== 'string') continue;
        addRule(signal.code, signal.reason, check.id, check.createdAt);
      }
    }

    const reportRule = ruleByCode.get('multiple_credible_reports');
    const reportCutoff = reportRule?.windowHours ? new Date(now.getTime() - reportRule.windowHours * 60 * 60 * 1000) : new Date(0);
    const escalatedReports = await tx.fraudReport.count({
      where: {
        reportedUserId: userId,
        status: FraudReportStatus.ESCALATED,
        createdAt: { gte: reportCutoff },
      },
    });
    if (escalatedReports >= 3) {
      addRule('multiple_credible_reports', 'At least three reports were escalated for administrator investigation.');
    }

    const risk = this.scoring.score(contributions);
    const storedRules = await tx.fraudRule.findMany({ select: { version: true } });
    const version = Math.max(1, ...storedRules.map((rule) => rule.version));
    const assessment = await tx.riskAssessment.create({
      data: {
        userId,
        sourceEventId,
        riskScore: risk.score,
        riskLevel: risk.level,
        assessmentVersion: `v${version}`,
        summary: contributions.length
          ? contributions.map((item) => item.reason).join(' ')
          : 'No configured risk indicators were detected. This is not a verification decision.',
        indicators: {
          create: contributions.map((item) => ({
            indicatorType: item.code,
            severity: item.severity,
            points: item.points,
            reason: item.reason,
            evidenceReference: item.evidenceReference,
          })),
        },
      },
      include: { indicators: true },
    });
    return assessment;
  }
}
