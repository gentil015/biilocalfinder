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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const slugify_1 = require("../common/utils/slugify");
const register_dto_1 = require("./dto/register.dto");
const auth_email_templates_1 = require("./auth-email-templates");
const email_sender_1 = require("../notifications/channels/email-sender");
const terms_constants_1 = require("../legal/terms.constants");
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_EXPIRES_MS = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 10) * 60 * 1000;
const RESET_REQUEST_RESPONSE = {
    success: true,
    message: 'If that email exists, a reset code has been sent.',
};
const RESET_REQUEST_MIN_MS = 300;
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwt, emailSender) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.emailSender = emailSender;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(dto) {
        if (!register_dto_1.REGISTERABLE_ROLES.includes(dto.role)) {
            throw new common_1.BadRequestException('Invalid role for self-registration');
        }
        if (dto.termsAccepted !== true || dto.termsVersion !== terms_constants_1.CURRENT_TERMS_VERSION) {
            throw new common_1.BadRequestException('You must accept the current Terms and Conditions to register');
        }
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
        });
        if (existing) {
            throw new common_1.ConflictException('Email or phone already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 12);
        let user;
        try {
            user = await this.prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        email: dto.email,
                        phone: dto.phone,
                        passwordHash,
                        firstName: dto.firstName,
                        lastName: dto.lastName,
                        role: dto.role,
                        ...(dto.role === 'CLIENT' ? { clientProfile: { create: {} } } : {}),
                    },
                });
                await tx.termsAcceptance.create({
                    data: {
                        userId: created.id,
                        documentType: terms_constants_1.TERMS_DOCUMENT_TYPE,
                        version: terms_constants_1.CURRENT_TERMS_VERSION,
                        accountRole: created.role,
                    },
                });
                const registrationEvent = await tx.securityEvent.create({
                    data: {
                        userId: created.id,
                        eventType: 'USER_REGISTERED',
                        dedupeKey: `registration:${created.id}`,
                    },
                });
                await tx.riskAssessment.create({
                    data: {
                        userId: created.id,
                        sourceEventId: registrationEvent.id,
                        riskScore: 0,
                        riskLevel: 'LOW',
                        assessmentVersion: 'v1',
                        summary: 'Account registered. No automated fraud finding was made.',
                    },
                });
                await this.acceptPendingInvites(tx, created.id, created.email);
                if (dto.role === 'PROVIDER')
                    await this.createProviderWorkspace(tx, created.id, `${dto.firstName} ${dto.lastName}`.trim());
                return created;
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('Email or phone already registered');
            }
            throw err;
        }
        return this.issueTokens(user.id, user.email, user.role);
    }
    async uniqueWorkspaceSlug(tx, name) {
        const base = (0, slugify_1.slugify)(name) || 'workspace';
        let candidate = base;
        let suffix = 1;
        while (await tx.workspace.findUnique({ where: { slug: candidate } })) {
            suffix += 1;
            candidate = `${base}-${suffix}`;
        }
        return candidate;
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user || !user.passwordHash)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        await this.assertAccountActive(user.id, user.status);
        return this.issueTokens(user.id, user.email, user.role);
    }
    async authenticateWithGoogle(identity, dto) {
        const existingBySub = await this.prisma.user.findUnique({ where: { googleSub: identity.sub } });
        if (existingBySub) {
            await this.assertAccountActive(existingBySub.id, existingBySub.status);
            const updated = await this.prisma.user.update({
                where: { id: existingBySub.id },
                data: {
                    googleEmail: identity.email,
                    emailVerified: true,
                    ...(existingBySub.avatarUrl ? {} : identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
                },
            });
            return this.issueTokens(updated.id, updated.email, updated.role);
        }
        const existingByEmail = await this.prisma.user.findUnique({ where: { email: identity.email } });
        if (existingByEmail) {
            if (!existingByEmail.emailVerified) {
                throw new common_1.UnauthorizedException('Verify your email before linking a Google account');
            }
            if (existingByEmail.googleSub && existingByEmail.googleSub !== identity.sub) {
                throw new common_1.ConflictException('This account is linked to a different Google account');
            }
            await this.assertAccountActive(existingByEmail.id, existingByEmail.status);
            const linked = await this.prisma.user.update({
                where: { id: existingByEmail.id },
                data: {
                    googleSub: identity.sub,
                    googleEmail: identity.email,
                    emailVerified: true,
                    ...(existingByEmail.avatarUrl ? {} : identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
                },
            });
            return this.issueTokens(linked.id, linked.email, linked.role);
        }
        return this.registerWithGoogle(identity, dto);
    }
    async registerWithGoogle(identity, dto) {
        const role = dto.role;
        if (!role || !register_dto_1.REGISTERABLE_ROLES.includes(role)) {
            throw new common_1.BadRequestException('Select an account type to continue with Google');
        }
        if (dto.termsAccepted !== true || dto.termsVersion !== terms_constants_1.CURRENT_TERMS_VERSION) {
            throw new common_1.BadRequestException('You must accept the current Terms and Conditions to register');
        }
        let user;
        try {
            user = await this.prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        email: identity.email,
                        googleSub: identity.sub,
                        googleEmail: identity.email,
                        passwordHash: null,
                        firstName: identity.firstName,
                        lastName: identity.lastName,
                        avatarUrl: identity.avatarUrl,
                        role,
                        emailVerified: true,
                        ...(role === 'CLIENT' ? { clientProfile: { create: {} } } : {}),
                    },
                });
                await tx.termsAcceptance.create({
                    data: {
                        userId: created.id,
                        documentType: terms_constants_1.TERMS_DOCUMENT_TYPE,
                        version: terms_constants_1.CURRENT_TERMS_VERSION,
                        accountRole: created.role,
                    },
                });
                const registrationEvent = await tx.securityEvent.create({
                    data: {
                        userId: created.id,
                        eventType: 'USER_REGISTERED',
                        dedupeKey: `registration:${created.id}`,
                    },
                });
                await tx.riskAssessment.create({
                    data: {
                        userId: created.id,
                        sourceEventId: registrationEvent.id,
                        riskScore: 0,
                        riskLevel: 'LOW',
                        assessmentVersion: 'v1',
                        summary: 'Account registered via Google. No automated fraud finding was made.',
                    },
                });
                await this.acceptPendingInvites(tx, created.id, created.email);
                if (role === 'PROVIDER')
                    await this.createProviderWorkspace(tx, created.id, `${created.firstName} ${created.lastName}`.trim());
                return created;
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException('An account with this email already exists');
            }
            throw err;
        }
        return this.issueTokens(user.id, user.email, user.role);
    }
    async assertAccountActive(userId, status) {
        if (status !== 'ACTIVE')
            throw new common_1.UnauthorizedException('Account is not active');
        const suspension = await this.prisma.accountRestriction.findFirst({
            where: {
                userId,
                status: 'ACTIVE',
                restrictionType: { in: [client_1.RestrictionType.TEMPORARY_SUSPENSION, client_1.RestrictionType.PERMANENT_SUSPENSION] },
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { id: true },
        });
        if (suspension)
            throw new common_1.UnauthorizedException('Account access is temporarily restricted');
    }
    async acceptPendingInvites(tx, userId, email) {
        const pendingInvites = await tx.workspaceInvitation.findMany({
            where: { email: email.toLowerCase(), acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
            select: { workspaceId: true, role: true },
        });
        for (const invite of pendingInvites) {
            const existingMembership = await tx.workspaceMembership.findUnique({
                where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
            });
            if (!existingMembership) {
                await tx.workspaceMembership.create({
                    data: { workspaceId: invite.workspaceId, userId, role: invite.role, status: 'INVITED', invitedEmail: email.toLowerCase(), invitedAt: new Date() },
                });
            }
        }
    }
    async createProviderWorkspace(tx, userId, businessName) {
        const workspace = await tx.workspace.create({
            data: { name: businessName, slug: await this.uniqueWorkspaceSlug(tx, businessName), type: 'INDIVIDUAL', ownerId: userId },
        });
        await tx.provider.create({ data: { userId, workspaceId: workspace.id, businessName } });
        await tx.workspaceMembership.create({
            data: { workspaceId: workspace.id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
        });
    }
    async refresh(refreshToken) {
        let payload;
        try {
            payload = this.jwt.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
        const tokenHash = this.hashToken(refreshToken);
        const stored = await this.prisma.refreshToken.findFirst({
            where: { userId: payload.sub, tokenHash, revokedAt: null },
        });
        if (!stored || stored.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Refresh token expired or revoked');
        }
        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        });
        const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
        return this.issueTokens(user.id, user.email, user.role);
    }
    async logout(userId, refreshToken) {
        const tokenHash = this.hashToken(refreshToken);
        await this.prisma.refreshToken.updateMany({
            where: { userId, tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { success: true };
    }
    async requestPasswordReset(email) {
        const startedAt = Date.now();
        try {
            const user = await this.prisma.user.findUnique({
                where: { email },
                select: { id: true, email: true, firstName: true },
            });
            if (user) {
                await this.prisma.passwordResetToken.updateMany({
                    where: { userId: user.id, usedAt: null },
                    data: { usedAt: new Date() },
                });
                const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
                await this.prisma.passwordResetToken.create({
                    data: {
                        userId: user.id,
                        tokenHash: this.hashResetCode(code),
                        expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS),
                    },
                });
                try {
                    await this.emailSender.send((0, auth_email_templates_1.passwordResetCodeEmail)(user.email, user.firstName, code));
                }
                catch (err) {
                    this.logger.error(`Password reset email failed for ${user.id}: ${err.message}`);
                }
            }
            return RESET_REQUEST_RESPONSE;
        }
        finally {
            const elapsed = Date.now() - startedAt;
            if (elapsed < RESET_REQUEST_MIN_MS) {
                await new Promise((resolve) => setTimeout(resolve, RESET_REQUEST_MIN_MS - elapsed));
            }
        }
    }
    async resetPassword(token, newPassword) {
        const tokenHash = this.hashResetCode(token.trim());
        const stored = await this.prisma.passwordResetToken.findFirst({
            where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
            select: { id: true, userId: true },
        });
        if (!stored) {
            throw new common_1.BadRequestException('This reset code is invalid or has expired.');
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: stored.userId },
                data: { passwordHash, emailVerified: true },
            });
            await tx.passwordResetToken.update({
                where: { id: stored.id },
                data: { usedAt: new Date() },
            });
            await tx.refreshToken.updateMany({
                where: { userId: stored.userId, revokedAt: null },
                data: { revokedAt: new Date() },
            });
        });
        return { success: true };
    }
    async issueTokens(userId, email, role) {
        const accessToken = this.jwt.sign({ sub: userId, email, role }, { secret: process.env.JWT_SECRET, expiresIn: ACCESS_EXPIRES_IN });
        const refreshToken = this.jwt.sign({ sub: userId }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: REFRESH_EXPIRES_IN });
        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenHash: this.hashToken(refreshToken),
                expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
            },
        });
        return { accessToken, refreshToken };
    }
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    hashResetCode(code) {
        const secret = process.env.PASSWORD_RESET_PEPPER ?? process.env.JWT_SECRET ?? 'insecure-reset-pepper';
        return crypto.createHmac('sha256', secret).update(code).digest('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(email_sender_1.EMAIL_SENDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map