"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VerificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const audit_log_service_1 = require("../common/services/audit-log.service");
const storage_interface_1 = require("../files/storage.interface");
const provider_context_service_1 = require("../providers/provider-context.service");
const verification_constants_1 = require("./verification.constants");
const verification_status_1 = require("./verification-status");
const file_sniffer_1 = require("./file-sniffer");
const storage_interface_2 = require("../files/storage.interface");
const TYPE_LABEL = {
    IDENTITY: 'identity',
    BUSINESS: 'business',
    SERVICE: 'service',
};
const RECORD_INCLUDE = {
    documents: {
        select: { id: true, documentType: true, mimeType: true, sizeBytes: true, originalName: true, createdAt: true },
    },
    serviceOffering: { select: { id: true, title: true, service: { select: { name: true } } } },
};
let VerificationService = VerificationService_1 = class VerificationService {
    constructor(prisma, notifications, auditLog, storage, providerContext) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.auditLog = auditLog;
        this.storage = storage;
        this.providerContext = providerContext;
        this.logger = new common_1.Logger(VerificationService_1.name);
    }
    async recomputeProvider(db, providerId, now = new Date()) {
        const provider = await db.provider.findUnique({
            where: { id: providerId },
            select: { id: true, user: { select: { phoneVerified: true } } },
        });
        if (!provider)
            return null;
        const records = await db.verificationRecord.findMany({
            where: { providerId, type: { in: verification_constants_1.PROVIDER_LEVEL_TYPES } },
            select: { type: true, status: true, expiresAt: true, updatedAt: true },
        });
        const state = (0, verification_status_1.computeProviderVerification)(records, { phoneVerified: provider.user.phoneVerified, now });
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
    async recomputeForUser(userId) {
        const provider = await this.providerContext.resolveForUser(userId).catch(() => null);
        if (provider)
            await this.recomputeProvider(this.prisma, provider.id);
    }
    async providerFor(userId) {
        const resolved = await this.providerContext.resolveForUser(userId).catch(() => null);
        if (!resolved)
            throw new common_1.ForbiddenException('Provider profile not found');
        return this.prisma.provider.findUniqueOrThrow({
            where: { id: resolved.id },
            include: { user: { select: { emailVerified: true, phoneVerified: true, phone: true } } },
        });
    }
    async uploadDocument(userId, file) {
        if (!file)
            throw new common_1.BadRequestException('No file provided');
        if (file.size > storage_interface_2.MAX_UPLOAD_BYTES)
            throw new common_1.BadRequestException('File is too large (max 8 MB)');
        const mime = (0, file_sniffer_1.sniffMime)(file.buffer);
        if (!mime)
            throw new common_1.BadRequestException('Only JPEG, PNG, WEBP images or PDF files are allowed');
        const provider = await this.providerFor(userId);
        const { key } = await this.storage.uploadPrivate(file.buffer, file.originalname, mime, `${verification_constants_1.VERIFICATION_DOC_PREFIX}/${provider.id}`);
        return { storageKey: key, mimeType: mime, sizeBytes: file.size, originalName: file.originalname.slice(0, 200) };
    }
    async submit(userId, dto, now = new Date()) {
        const provider = await this.providerFor(userId);
        if (dto.type === 'SERVICE') {
            if (!dto.serviceOfferingId)
                throw new common_1.BadRequestException('serviceOfferingId is required for a service verification');
            const offering = await this.prisma.serviceOffering.findUnique({ where: { id: dto.serviceOfferingId } });
            if (!offering || offering.providerId !== provider.id)
                throw new common_1.NotFoundException('Service offering not found');
        }
        else if (dto.serviceOfferingId) {
            throw new common_1.BadRequestException('serviceOfferingId is only valid for a service verification');
        }
        const offeringId = dto.type === 'SERVICE' ? dto.serviceOfferingId : null;
        const accepted = verification_constants_1.ACCEPTED_DOCUMENTS[dto.type];
        const ownPrefix = `${verification_constants_1.VERIFICATION_DOC_PREFIX}/${provider.id}/`;
        const seen = new Set();
        for (const d of dto.documents) {
            if (!accepted.includes(d.documentType)) {
                throw new common_1.BadRequestException(`${d.documentType} is not accepted for a ${TYPE_LABEL[dto.type]} verification`);
            }
            if (!d.storageKey.startsWith(ownPrefix) || d.storageKey.includes('..')) {
                throw new common_1.BadRequestException('Invalid document reference');
            }
            if (seen.has(d.storageKey))
                throw new common_1.BadRequestException('The same document was attached twice');
            seen.add(d.storageKey);
        }
        if (!dto.documents.some((d) => verification_constants_1.REQUIRED_ANY_OF[dto.type].includes(d.documentType))) {
            throw new common_1.BadRequestException(`Attach at least one of: ${verification_constants_1.REQUIRED_ANY_OF[dto.type].map((t) => t.replace(/_/g, ' ').toLowerCase()).join(', ')}`);
        }
        const stats = await Promise.all(dto.documents.map((d) => this.storage.statObject(d.storageKey)));
        if (stats.some((s) => !s))
            throw new common_1.BadRequestException('One or more documents were not found. Upload them again.');
        const existing = await this.prisma.verificationRecord.findMany({
            where: { providerId: provider.id, type: dto.type, serviceOfferingId: offeringId },
            select: { status: true, expiresAt: true },
        });
        if (existing.some((r) => r.status === 'SUSPENDED')) {
            throw new common_1.ForbiddenException('This verification is suspended. Please contact support.');
        }
        if (existing.some((r) => r.status === 'PENDING')) {
            throw new common_1.ConflictException('You already have a submission under review.');
        }
        const live = existing.find((r) => (0, verification_status_1.isLive)(r, now));
        if (live?.expiresAt && live.expiresAt.getTime() - now.getTime() > verification_constants_1.RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000) {
            throw new common_1.ConflictException('This is already verified. You can renew it within 30 days of expiry.');
        }
        let created;
        try {
            created = await this.prisma.$transaction(async (tx) => {
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
                                mimeType: stats[i].mimeType,
                                sizeBytes: stats[i].sizeBytes,
                            })),
                        },
                    },
                    include: RECORD_INCLUDE,
                });
                await this.recomputeProvider(tx, provider.id, now);
                return record;
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('You already have a submission under review.');
            }
            throw err;
        }
        return created;
    }
    async myStatus(userId, now = new Date()) {
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
        const renewalCutoff = (0, verification_constants_1.addDays)(now, verification_constants_1.RENEWAL_WINDOW_DAYS);
        const nextSteps = [];
        if (!provider.user.phone)
            nextSteps.push('ADD_PHONE');
        else if (!provider.user.phoneVerified)
            nextSteps.push('VERIFY_PHONE');
        if (!provider.user.emailVerified)
            nextSteps.push('VERIFY_EMAIL');
        const forType = (t) => records.filter((r) => r.type === t && r.serviceOfferingId === null);
        const identity = forType('IDENTITY');
        if (!identity.some((r) => r.status === 'PENDING' || r.status === 'SUSPENDED' || (0, verification_status_1.isLive)(r, now))) {
            nextSteps.push('SUBMIT_IDENTITY');
        }
        else if (identity.some((r) => (0, verification_status_1.isLive)(r, now) && r.expiresAt && r.expiresAt <= renewalCutoff) && !identity.some((r) => r.status === 'PENDING')) {
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
    toProviderView(r, now) {
        return {
            id: r.id,
            type: r.type,
            status: r.status,
            offering: r.serviceOffering ? { id: r.serviceOffering.id, name: r.serviceOffering.title || r.serviceOffering.service.name } : null,
            legalName: r.legalName,
            referenceNumber: r.referenceNumber,
            decisionNote: r.status === 'REJECTED' || r.status === 'SUSPENDED' ? r.decisionNote : null,
            submittedAt: r.submittedAt,
            verifiedAt: r.verifiedAt,
            expiresAt: r.expiresAt,
            expiringSoon: (0, verification_status_1.isLive)(r, now) && !!r.expiresAt && r.expiresAt <= (0, verification_constants_1.addDays)(now, verification_constants_1.EXPIRY_REMINDER_DAYS),
            documents: r.documents,
        };
    }
    async queue(query) {
        const page = Number(query.page) || 1;
        const limit = 20;
        const where = {
            status: query.status ?? 'PENDING',
            ...(query.type ? { type: query.type } : {}),
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.verificationRecord.findMany({
                where,
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
    async getForReview(id, adminId) {
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
        if (!record)
            throw new common_1.NotFoundException('Verification record not found');
        const [documents, history, openReports] = await Promise.all([
            Promise.all(record.documents.map(async (d) => ({
                id: d.id,
                documentType: d.documentType,
                mimeType: d.mimeType,
                sizeBytes: d.sizeBytes,
                url: await this.storage.getSignedUrl(d.storageKey, verification_constants_1.SIGNED_URL_TTL_SECONDS),
            }))),
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
        return { ...record, documents, documentLinksExpireInSeconds: verification_constants_1.SIGNED_URL_TTL_SECONDS, history, openReports };
    }
    async loadForDecision(id) {
        const record = await this.prisma.verificationRecord.findUnique({
            where: { id },
            include: { provider: { select: { id: true, userId: true } } },
        });
        if (!record)
            throw new common_1.NotFoundException('Verification record not found');
        return record;
    }
    assertTransition(from, to) {
        if (!(0, verification_status_1.canTransition)(from, to)) {
            throw new common_1.BadRequestException(`A ${from.toLowerCase()} verification cannot be changed to ${to.toLowerCase()}`);
        }
    }
    async approve(id, adminId, dto, now = new Date()) {
        const record = await this.loadForDecision(id);
        this.assertTransition(record.status, 'VERIFIED');
        const expiresAt = (0, verification_constants_1.addMonths)(now, dto.validityMonths ?? verification_constants_1.DEFAULT_VALIDITY_MONTHS);
        const updated = await this.prisma.$transaction(async (tx) => {
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
    async reject(id, adminId, dto, now = new Date()) {
        const record = await this.loadForDecision(id);
        this.assertTransition(record.status, 'REJECTED');
        const updated = await this.prisma.$transaction(async (tx) => {
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
    async suspend(id, adminId, dto, now = new Date()) {
        const record = await this.loadForDecision(id);
        this.assertTransition(record.status, 'SUSPENDED');
        const updated = await this.prisma.$transaction(async (tx) => {
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
    async reinstate(id, adminId, dto, now = new Date()) {
        const record = await this.loadForDecision(id);
        if (record.status !== 'SUSPENDED')
            throw new common_1.BadRequestException('Only a suspended verification can be reinstated');
        const stillValid = !record.expiresAt || record.expiresAt.getTime() > now.getTime();
        const target = stillValid ? 'VERIFIED' : 'EXPIRED';
        this.assertTransition(record.status, target);
        const updated = await this.prisma.$transaction(async (tx) => {
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
        await this.notifyProvider(record.provider.userId, record.type, stillValid ? `Your ${TYPE_LABEL[record.type]} verification was reinstated` : `Your ${TYPE_LABEL[record.type]} verification has expired`, undefined, id);
        return updated;
    }
    async sweepExpired(now = new Date()) {
        const due = await this.prisma.verificationRecord.findMany({
            where: { status: 'VERIFIED', expiresAt: { lte: now } },
            include: { provider: { select: { userId: true } } },
        });
        let expired = 0;
        for (const record of due) {
            const changed = await this.prisma.$transaction(async (tx) => {
                const res = await tx.verificationRecord.updateMany({
                    where: { id: record.id, status: 'VERIFIED' },
                    data: { status: 'EXPIRED', decisionNote: 'Verification period ended', reviewedAt: now },
                });
                if (res.count > 0)
                    await this.recomputeProvider(tx, record.providerId, now);
                return res.count > 0;
            });
            if (changed) {
                expired++;
                await this.notifyProvider(record.provider.userId, record.type, `Your ${TYPE_LABEL[record.type]} verification has expired`, 'Submit your documents again to get your badge back.', record.id);
            }
        }
        const soon = await this.prisma.verificationRecord.findMany({
            where: {
                status: 'VERIFIED',
                expiresAt: { gt: now, lte: (0, verification_constants_1.addDays)(now, verification_constants_1.EXPIRY_REMINDER_DAYS) },
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
            if (res.count === 0)
                continue;
            reminded++;
            await this.notifications.notify({
                userId: record.provider.userId,
                type: 'VERIFICATION_EXPIRING',
                title: `Your ${TYPE_LABEL[record.type]} verification expires soon`,
                body: `It ends on ${record.expiresAt.toISOString().slice(0, 10)}. Renew it to keep your badge.`,
                data: { verificationId: record.id },
            });
        }
        this.logger.log(`Verification sweep: ${expired} expired, ${reminded} reminders sent`);
        return { expired, reminded };
    }
    async notifyProvider(userId, type, title, body, verificationId) {
        await this.notifications.notify({
            userId,
            type: 'VERIFICATION_UPDATED',
            title,
            body,
            data: { verificationId, verificationType: type },
        });
    }
};
exports.VerificationService = VerificationService;
exports.VerificationService = VerificationService = VerificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(storage_interface_1.STORAGE_SERVICE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        audit_log_service_1.AuditLogService, Object, provider_context_service_1.ProviderContextService])
], VerificationService);
//# sourceMappingURL=verification.service.js.map