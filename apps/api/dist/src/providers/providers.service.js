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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const availability_service_1 = require("../availability/availability.service");
const entitlements_service_1 = require("../subscriptions/entitlements.service");
const provider_context_service_1 = require("./provider-context.service");
const interaction_service_1 = require("../personalization/interactions/interaction.service");
const geo_1 = require("../common/utils/geo");
const TYPES_WITH_TEAM_ROSTER = ['TEAM', 'AGENCY'];
const PUBLIC_PROVIDER_INCLUDE = {
    location: true,
    services: {
        where: { isActive: true },
        include: {
            service: { include: { category: true } },
            attributeValues: { include: { categoryAttribute: true } },
        },
    },
    serviceAreas: true,
    availabilities: true,
    portfolios: {
        include: { images: { orderBy: { position: 'asc' } }, service: true },
        orderBy: { createdAt: 'desc' },
    },
    reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } } },
    },
    user: { select: { firstName: true, lastName: true, avatarUrl: true } },
};
let ProvidersService = class ProvidersService {
    constructor(prisma, notifications, availability, interactions, entitlements, providerContext) {
        this.prisma = prisma;
        this.notifications = notifications;
        this.availability = availability;
        this.interactions = interactions;
        this.entitlements = entitlements;
        this.providerContext = providerContext;
    }
    async getByUserId(userId) {
        const resolved = await this.providerContext.resolveForUser(userId).catch(() => null);
        if (!resolved)
            throw new common_1.NotFoundException('Provider profile not found');
        const provider = await this.prisma.provider.findUnique({
            where: { id: resolved.id },
            include: PUBLIC_PROVIDER_INCLUDE,
        });
        if (!provider)
            throw new common_1.NotFoundException('Provider profile not found');
        return provider;
    }
    async getPublicProfile(id, viewerUserId, coords) {
        const provider = await this.prisma.provider.findUnique({
            where: { id },
            include: PUBLIC_PROVIDER_INCLUDE,
        });
        if (!provider)
            throw new common_1.NotFoundException('Provider not found');
        if (provider.onboardingStep !== 'COMPLETED' && provider.userId !== viewerUserId) {
            throw new common_1.NotFoundException('Provider not found');
        }
        if (viewerUserId) {
            await this.interactions.record(viewerUserId, 'VIEW_PROVIDER', 'PROVIDER', id);
        }
        const availability = await this.availability.summaryForProvider(id);
        let location = {
            distanceKm: null,
            servesQueriedLocation: null,
        };
        if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
            const distanceKm = provider.location
                ? (0, geo_1.haversineKm)(provider.location.latitude, provider.location.longitude, coords.lat, coords.lng)
                : null;
            const servesQueriedLocation = (0, geo_1.coversPoint)(provider.serviceAreas, coords);
            location = { distanceKm, servesQueriedLocation };
        }
        return { ...provider, availability, ...location };
    }
    async compare(ids) {
        const unique = Array.from(new Set(ids));
        if (unique.length < 2)
            throw new common_1.BadRequestException('Pick at least 2 providers to compare');
        if (unique.length > 3)
            throw new common_1.BadRequestException('You can compare up to 3 providers at a time');
        const providers = await this.prisma.provider.findMany({
            where: { id: { in: unique }, onboardingStep: 'COMPLETED' },
            select: {
                id: true,
                businessName: true,
                logoUrl: true,
                rating: true,
                reviewCount: true,
                verifiedReviewCount: true,
                yearsOfExperience: true,
                responseTimeMinutes: true,
                verificationStatus: true,
                businessVerified: true,
                user: { select: { avatarUrl: true } },
                location: { select: { city: true } },
                services: {
                    where: { isActive: true, basePrice: { not: null } },
                    select: { basePrice: true, currency: true },
                    orderBy: { basePrice: 'asc' },
                    take: 1,
                },
            },
        });
        if (providers.length !== unique.length)
            throw new common_1.NotFoundException('One or more providers were not found');
        const availabilityById = await this.availability.summariesForProviders(unique);
        const byId = new Map(providers.map((p) => [p.id, p]));
        return unique.map((id) => {
            const p = byId.get(id);
            return {
                id: p.id,
                businessName: p.businessName,
                avatarUrl: p.logoUrl ?? p.user?.avatarUrl,
                city: p.location?.city ?? null,
                rating: Number(p.rating),
                reviewCount: p.reviewCount,
                verifiedReviewCount: p.verifiedReviewCount,
                yearsOfExperience: p.yearsOfExperience,
                responseTimeMinutes: p.responseTimeMinutes,
                verificationStatus: p.verificationStatus,
                businessVerified: p.businessVerified,
                startingPrice: p.services?.[0] ? Number(p.services[0].basePrice) : null,
                currency: p.services?.[0]?.currency ?? 'RWF',
                availability: availabilityById.get(id) ?? null,
            };
        });
    }
    async updateProfile(userId, dto) {
        const provider = await this.getByUserId(userId);
        const { phone, ...rest } = dto;
        if (phone !== undefined) {
            await this.prisma.user.update({
                where: { id: userId },
                data: { phone: phone?.trim() ? phone.trim() : null },
            });
        }
        return this.prisma.provider.update({
            where: { id: provider.id },
            data: {
                ...rest,
                ...(rest.logoUrl !== undefined ? { logoUrl: rest.logoUrl.trim() || null } : {}),
            },
        });
    }
    async setLocation(userId, dto) {
        const provider = await this.getByUserId(userId);
        const location = await this.prisma.location.create({
            data: {
                latitude: dto.latitude,
                longitude: dto.longitude,
                addressLine: dto.addressLine,
                city: dto.city,
                label: dto.label,
            },
        });
        return this.prisma.provider.update({
            where: { id: provider.id },
            data: { locationId: location.id },
            include: { location: true },
        });
    }
    async addServiceArea(userId, dto) {
        const provider = await this.getByUserId(userId);
        return this.prisma.serviceArea.create({
            data: { providerId: provider.id, ...dto },
        });
    }
    async removeServiceArea(userId, areaId) {
        const provider = await this.getByUserId(userId);
        const area = await this.prisma.serviceArea.findUnique({ where: { id: areaId } });
        if (!area || area.providerId !== provider.id)
            throw new common_1.NotFoundException('Not found');
        await this.prisma.serviceArea.delete({ where: { id: areaId } });
        return { success: true };
    }
    async getOwnProviderRow(userId) {
        return this.providerContext.resolveForUser(userId);
    }
    async getOnboardingState(userId) {
        const own = await this.providerContext.resolveForUser(userId);
        const provider = await this.prisma.provider.findUnique({
            where: { id: own.id },
            include: {
                location: true,
                teamMembers: { orderBy: { createdAt: 'asc' } },
                services: { where: { isActive: true }, select: { id: true }, take: 1 },
                user: { select: { phone: true, email: true, avatarUrl: true } },
            },
        });
        if (!provider)
            throw new common_1.NotFoundException('Provider profile not found');
        return {
            providerType: provider.providerType,
            onboardingStep: provider.onboardingStep,
            onboardingCompletedAt: provider.onboardingCompletedAt,
            businessName: provider.businessName,
            description: provider.description,
            bio: provider.bio,
            phone: provider.phone,
            registrationNumber: provider.registrationNumber,
            representativeName: provider.representativeName,
            teamSize: provider.teamSize,
            logoUrl: provider.logoUrl,
            location: provider.location,
            hasActiveOffering: provider.services.length > 0,
            teamMembers: provider.teamMembers,
            accountPhone: provider.user.phone,
            accountEmail: provider.user.email,
            accountAvatarUrl: provider.user.avatarUrl,
        };
    }
    async selectProviderType(userId, dto) {
        const provider = await this.getOwnProviderRow(userId);
        const isFirstSelection = provider.onboardingStep === 'TYPE_SELECTION';
        const isChangingType = !isFirstSelection && provider.providerType !== dto.providerType;
        const nextStep = isFirstSelection || isChangingType ? 'PROFILE_DETAILS' : provider.onboardingStep;
        return this.applyOnboardingChange(provider, {
            providerType: dto.providerType,
            onboardingStep: nextStep,
        });
    }
    async applyOnboardingChange(provider, data) {
        const workspaceData = {};
        const providerType = typeof data.providerType === 'string' ? data.providerType : data.providerType?.set ?? undefined;
        if (providerType)
            workspaceData.type = providerType;
        if (data.onboardingStep)
            workspaceData.onboardingStep = data.onboardingStep;
        if (data.onboardingCompletedAt)
            workspaceData.onboardingCompletedAt = data.onboardingCompletedAt;
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.provider.update({ where: { id: provider.id }, data });
            await tx.workspace.update({ where: { id: provider.workspaceId }, data: workspaceData });
            return updated;
        });
    }
    async updateOnboardingProfile(userId, dto) {
        const provider = await this.getOwnProviderRow(userId);
        if (!provider.providerType) {
            throw new common_1.BadRequestException('Choose a provider type before completing your profile');
        }
        const nextBusinessName = dto.businessName?.trim() ?? provider.businessName;
        if (!nextBusinessName) {
            throw new common_1.BadRequestException(provider.providerType === 'INDIVIDUAL' ? 'Full name is required' : 'Name is required');
        }
        if ((provider.providerType === 'BUSINESS' || provider.providerType === 'AGENCY') &&
            !(dto.representativeName?.trim() ?? provider.representativeName)) {
            throw new common_1.BadRequestException('Authorized representative name is required');
        }
        const shouldAdvance = provider.onboardingStep === 'PROFILE_DETAILS';
        return this.applyOnboardingChange(provider, {
            businessName: nextBusinessName,
            bio: dto.bio ?? provider.bio,
            phone: dto.phone ?? provider.phone,
            registrationNumber: dto.registrationNumber ?? provider.registrationNumber,
            representativeName: dto.representativeName ?? provider.representativeName,
            teamSize: dto.teamSize ?? provider.teamSize,
            logoUrl: dto.logoUrl ?? provider.logoUrl,
            ...(shouldAdvance ? { onboardingStep: 'SERVICES_SETUP' } : {}),
        });
    }
    async completeOnboarding(userId) {
        const provider = await this.getOwnProviderRow(userId);
        if (!provider.providerType) {
            throw new common_1.BadRequestException('Choose a provider type before finishing setup');
        }
        if (provider.onboardingStep === 'COMPLETED') {
            return provider;
        }
        if (!provider.locationId) {
            throw new common_1.BadRequestException('Set your service location before finishing setup');
        }
        const offeringCount = await this.prisma.serviceOffering.count({
            where: { providerId: provider.id, isActive: true },
        });
        if (offeringCount === 0) {
            throw new common_1.BadRequestException('Add at least one service before finishing setup');
        }
        return this.applyOnboardingChange(provider, {
            onboardingStep: 'COMPLETED',
            onboardingCompletedAt: new Date(),
        });
    }
    async listTeamMembers(userId) {
        const provider = await this.getOwnProviderRow(userId);
        return this.prisma.providerTeamMember.findMany({
            where: { providerId: provider.id },
            orderBy: { createdAt: 'asc' },
        });
    }
    async addTeamMember(userId, dto) {
        const provider = await this.getOwnProviderRow(userId);
        if (!provider.providerType || !TYPES_WITH_TEAM_ROSTER.includes(provider.providerType)) {
            throw new common_1.BadRequestException('Only team and agency profiles can add team members');
        }
        if (!dto.name && !dto.email && !dto.phone) {
            throw new common_1.BadRequestException('Provide at least a name, email, or phone number for this team member');
        }
        if (provider.providerType === 'AGENCY') {
            await this.entitlements.assertCanAdd(provider, 'managedProviders');
        }
        return this.prisma.providerTeamMember.create({
            data: { providerId: provider.id, ...dto },
        });
    }
    async removeTeamMember(userId, memberId) {
        const provider = await this.getOwnProviderRow(userId);
        const member = await this.prisma.providerTeamMember.findUnique({ where: { id: memberId } });
        if (!member || member.providerId !== provider.id)
            throw new common_1.NotFoundException('Team member not found');
        await this.prisma.providerTeamMember.delete({ where: { id: memberId } });
        return { success: true };
    }
};
exports.ProvidersService = ProvidersService;
exports.ProvidersService = ProvidersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService,
        availability_service_1.AvailabilityService,
        interaction_service_1.InteractionService,
        entitlements_service_1.EntitlementsService,
        provider_context_service_1.ProviderContextService])
], ProvidersService);
//# sourceMappingURL=providers.service.js.map