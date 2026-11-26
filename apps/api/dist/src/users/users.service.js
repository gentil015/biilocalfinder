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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_log_service_1 = require("../common/services/audit-log.service");
const storage_interface_1 = require("../files/storage.interface");
const verification_service_1 = require("../verification/verification.service");
let UsersService = UsersService_1 = class UsersService {
    constructor(prisma, audit, storage, verification) {
        this.prisma = prisma;
        this.audit = audit;
        this.storage = storage;
        this.verification = verification;
        this.logger = new common_1.Logger(UsersService_1.name);
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: true,
                status: true,
                emailVerified: true,
                phoneVerified: true,
                locale: true,
                createdAt: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async updateMe(id, data) {
        const current = await this.prisma.user.findUnique({
            where: { id },
            select: { phone: true },
        });
        if (!current)
            throw new common_1.NotFoundException('User not found');
        const nextPhone = data.phone !== undefined ? data.phone?.trim() || null : undefined;
        const phoneChanged = nextPhone !== undefined && nextPhone !== current.phone;
        const update = {};
        if (nextPhone !== undefined) {
            update.phone = nextPhone;
            if (phoneChanged)
                update.phoneVerified = false;
        }
        if (data.firstName !== undefined)
            update.firstName = data.firstName;
        if (data.lastName !== undefined)
            update.lastName = data.lastName;
        if (data.avatarUrl !== undefined)
            update.avatarUrl = data.avatarUrl;
        if (Object.keys(update).length === 0)
            return this.findById(id);
        if (nextPhone) {
            const existing = await this.prisma.user.findFirst({
                where: { phone: nextPhone, id: { not: id } },
                select: { id: true },
            });
            if (existing)
                throw new common_1.BadRequestException('Phone number already in use');
        }
        const ownedProviderIds = phoneChanged
            ? (await this.prisma.provider.findMany({
                where: { userId: id },
                select: { id: true },
            })).map((provider) => provider.id)
            : [];
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id }, data: update });
            if (phoneChanged) {
                await tx.contactVerificationCode.updateMany({
                    where: { userId: id, channel: 'PHONE', consumedAt: null },
                    data: { consumedAt: new Date() },
                });
                for (const providerId of ownedProviderIds) {
                    await this.verification.recomputeProvider(tx, providerId);
                }
            }
        });
        if (phoneChanged) {
            await this.verification.recomputeForUser(id).catch((err) => {
                this.logger.warn(`Could not recompute provider verification for ${id}: ${err.message}`);
            });
            await this.audit.log(id, 'USER_PHONE_CHANGED', 'User', id).catch((err) => {
                this.logger.warn(`Could not audit phone change for ${id}: ${err.message}`);
            });
        }
        return this.findById(id);
    }
    async updateLocale(id, locale) {
        await this.prisma.user.update({ where: { id }, data: { locale } });
        return this.findById(id);
    }
    async exportMe(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: true,
                status: true,
                emailVerified: true,
                phoneVerified: true,
                locale: true,
                createdAt: true,
                updatedAt: true,
                clientProfile: {
                    include: {
                        serviceRequests: { include: { quotes: true, booking: true } },
                        bookings: true,
                        reviews: { include: { images: true } },
                        conversations: { include: { conversation: { include: { messages: true } } } },
                    },
                },
                providers: {
                    include: {
                        location: true,
                        services: true,
                        serviceAreas: true,
                        portfolios: { include: { images: true } },
                        availabilities: true,
                        availabilityExceptions: true,
                        verifications: { include: { documents: true } },
                        experiences: true,
                        educations: true,
                        teamMembers: true,
                        subscriptions: true,
                    },
                },
                ownedWorkspaces: { include: { memberships: true } },
                workspaceMemberships: true,
                favorites: true,
                savedSearches: true,
                notifications: true,
                sentMessages: { include: { attachments: true } },
                reportsFiled: true,
                disputesRaised: { include: { messages: true, evidence: true } },
                disputesAgainst: { include: { messages: true, evidence: true } },
                disputeEvidence: true,
                providerApplications: true,
            },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const [preference, interests, interactions, recommendations] = await Promise.all([
            this.prisma.userPreference.findUnique({ where: { userId: id } }),
            this.prisma.userInterest.findMany({ where: { userId: id } }),
            this.prisma.userInteraction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 5000 }),
            this.prisma.recommendationCache.findMany({ where: { userId: id } }),
        ]);
        await this.audit.log(id, 'ACCOUNT_DATA_EXPORTED', 'User', id).catch((err) => {
            this.logger.warn(`Could not audit account export ${id}: ${err.message}`);
        });
        return {
            exportedAt: new Date().toISOString(),
            formatVersion: 1,
            user,
            personalization: { preference, interests, interactions, recommendations },
        };
    }
    async deleteMe(id, password) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, role: true, passwordHash: true, status: true },
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (!user.passwordHash) {
            throw new common_1.BadRequestException('Set a password before deleting this account');
        }
        if (!(await bcrypt.compare(password, user.passwordHash))) {
            throw new common_1.UnauthorizedException('Incorrect password');
        }
        if (user.role === 'ADMIN') {
            const otherAdmins = await this.prisma.user.count({
                where: { role: 'ADMIN', status: 'ACTIVE', id: { not: id } },
            });
            if (otherAdmins === 0) {
                throw new common_1.BadRequestException('The last active admin account cannot be deleted');
            }
        }
        const [providers, ownedWorkspaces] = await Promise.all([
            this.prisma.provider.findMany({
                where: { userId: id },
                select: { id: true },
            }),
            this.prisma.workspace.findMany({
                where: { ownerId: id },
                select: { id: true },
            }),
        ]);
        const providerIds = providers.map((provider) => provider.id);
        const [verificationDocs, portfolioImages, reviewImages, evidence, attachments] = await Promise.all([
            providerIds.length
                ? this.prisma.verificationDocument.findMany({
                    where: { verification: { providerId: { in: providerIds } } },
                    select: { storageKey: true },
                })
                : Promise.resolve([]),
            providerIds.length
                ? this.prisma.portfolioImage.findMany({
                    where: { portfolio: { providerId: { in: providerIds } } },
                    select: { storageKey: true },
                })
                : Promise.resolve([]),
            this.prisma.reviewImage.findMany({
                where: { review: { client: { userId: id } } },
                select: { storageKey: true },
            }),
            this.prisma.disputeEvidence.findMany({
                where: {
                    uploaderId: id,
                    dispute: { status: { in: ['RESOLVED', 'REJECTED'] } },
                },
                select: { storageKey: true },
            }),
            this.prisma.messageAttachment.findMany({
                where: { message: { senderId: id } },
                select: { storageKey: true },
            }),
        ]);
        const storageKeys = [
            ...verificationDocs,
            ...portfolioImages,
            ...reviewImages,
            ...evidence,
            ...attachments,
        ].map((item) => item.storageKey);
        const unusablePasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
        const deletedEmail = `deleted+${id}@deleted.invalid`;
        await this.prisma.$transaction(async (tx) => {
            if (providerIds.length) {
                await tx.verificationDocument.deleteMany({
                    where: { verification: { providerId: { in: providerIds } } },
                });
                await tx.portfolioImage.deleteMany({ where: { portfolio: { providerId: { in: providerIds } } } });
                await tx.portfolio.deleteMany({ where: { providerId: { in: providerIds } } });
                await tx.providerExperience.deleteMany({ where: { providerId: { in: providerIds } } });
                await tx.providerEducation.deleteMany({ where: { providerId: { in: providerIds } } });
                await tx.providerTeamMember.updateMany({
                    where: {
                        OR: [{ providerId: { in: providerIds } }, { linkedProviderId: { in: providerIds } }],
                    },
                    data: { name: null, email: null, phone: null },
                });
                await tx.provider.updateMany({
                    where: { id: { in: providerIds } },
                    data: {
                        businessName: 'Deleted provider',
                        description: null,
                        bio: null,
                        phone: null,
                        locationId: null,
                        registrationNumber: null,
                        representativeName: null,
                        logoUrl: null,
                        verificationStatus: 'UNVERIFIED',
                        identityVerified: false,
                        businessVerified: false,
                        verificationExpiresAt: null,
                        availabilityStatus: 'UNAVAILABLE',
                    },
                });
            }
            for (const workspace of ownedWorkspaces) {
                await tx.workspace.update({
                    where: { id: workspace.id },
                    data: { name: 'Deleted workspace', slug: `deleted-${workspace.id}`, status: 'CLOSED' },
                });
            }
            await tx.workspaceMembership.deleteMany({ where: { userId: id } });
            await tx.clientProfile.updateMany({ where: { userId: id }, data: { bio: null } });
            await tx.favorite.deleteMany({ where: { userId: id } });
            await tx.savedSearch.deleteMany({ where: { userId: id } });
            await tx.notificationPreference.deleteMany({ where: { userId: id } });
            await tx.pushSubscription.deleteMany({ where: { userId: id } });
            await tx.notification.deleteMany({ where: { userId: id } });
            await tx.userInteraction.deleteMany({ where: { userId: id } });
            await tx.userInterest.deleteMany({ where: { userId: id } });
            await tx.userPreference.deleteMany({ where: { userId: id } });
            await tx.recommendationCache.deleteMany({ where: { userId: id } });
            await tx.refreshToken.deleteMany({ where: { userId: id } });
            await tx.passwordResetToken.deleteMany({ where: { userId: id } });
            await tx.contactVerificationCode.deleteMany({ where: { userId: id } });
            await tx.messageAttachment.deleteMany({ where: { message: { senderId: id } } });
            await tx.message.updateMany({ where: { senderId: id }, data: { body: null } });
            await tx.reviewImage.deleteMany({ where: { review: { client: { userId: id } } } });
            await tx.review.updateMany({ where: { client: { userId: id } }, data: { comment: null } });
            await tx.disputeEvidence.deleteMany({
                where: {
                    uploaderId: id,
                    dispute: { status: { in: ['RESOLVED', 'REJECTED'] } },
                },
            });
            await tx.dispute.updateMany({
                where: { OR: [{ raisedById: id }, { respondentId: id }] },
                data: { details: null },
            });
            await tx.report.updateMany({ where: { reporterId: id }, data: { details: null } });
            await tx.providerApplication.updateMany({
                where: { userId: id },
                data: {
                    idNumber: null,
                    registrationNumber: null,
                    websiteUrl: null,
                    phone: null,
                    description: null,
                    decisionNote: null,
                },
            });
            await tx.user.update({
                where: { id },
                data: {
                    email: deletedEmail,
                    phone: null,
                    passwordHash: unusablePasswordHash,
                    googleSub: null,
                    googleEmail: null,
                    firstName: 'Deleted',
                    lastName: 'Member',
                    avatarUrl: null,
                    status: 'DEACTIVATED',
                    emailVerified: false,
                    phoneVerified: false,
                    locale: 'en',
                },
            });
        });
        for (const key of storageKeys) {
            try {
                await this.storage.delete(key);
            }
            catch (err) {
                this.logger.warn(`Could not delete account object ${key}: ${err.message}`);
            }
        }
        await this.audit.log(id, 'ACCOUNT_DELETED', 'User', id, { providers: providerIds.length }).catch((err) => {
            this.logger.warn(`Could not audit account deletion ${id}: ${err.message}`);
        });
        return { success: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(storage_interface_1.STORAGE_SERVICE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService, Object, verification_service_1.VerificationService])
], UsersService);
//# sourceMappingURL=users.service.js.map