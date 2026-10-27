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
                if (dto.role === 'PROVIDER') {
                    const businessName = `${dto.firstName} ${dto.lastName}`;
                    const workspace = await tx.workspace.create({
                        data: {
                            name: businessName,
                            slug: await this.uniqueWorkspaceSlug(tx, businessName),
                            type: 'INDIVIDUAL',
                            ownerId: created.id,
                        },
                    });
                    await tx.provider.create({
                        data: { userId: created.id, workspaceId: workspace.id, businessName },
                    });
                    await tx.workspaceMembership.create({
                        data: { workspaceId: workspace.id, userId: created.id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
                    });
                }
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
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (user.status !== 'ACTIVE') {
            throw new common_1.UnauthorizedException('Account is not active');
        }
        return this.issueTokens(user.id, user.email, user.role);
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
                const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
                await this.prisma.passwordResetToken.create({
                    data: {
                        userId: user.id,
                        tokenHash: this.hashToken(code),
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
        const tokenHash = this.hashToken(token.trim());
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
                data: { passwordHash },
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
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(email_sender_1.EMAIL_SENDER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map