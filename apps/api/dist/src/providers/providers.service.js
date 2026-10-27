"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvidersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const availability_service_1 = require("../availability/availability.service");
const verification_status_1 = require("../verification/verification-status");
const WORKSPACE_ROLE_TO_PROVIDER_ROLE = {
    MANAGER: 'MANAGER',
    MEMBER: 'MEMBER',
};
let ProvidersService = class ProvidersService {
    constructor(prisma, availability) {
        this.prisma = prisma;
        this.availability = availability;
    }
    async getByUserId(userId) {
        const provider = await this.prisma.provider.findUnique({ where: { userId }, include: { user: true, location: true } });
        if (!provider)
            throw new common_1.NotFoundException('Provider profile not found');
        return provider;
    }
    async getPublicProfile(id, viewerId, coords) {
        const provider = await this.prisma.provider.findUnique({
            where: { id },
            include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                location: true,
                services: { where: { isActive: true }, include: { service: { include: { category: true } }, attributeValues: { include: { categoryAttribute: true } } } },
                portfolioItems: { orderBy: { createdAt: 'desc' } },
                reviews: { where: { status: 'APPROVED' }, orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!provider)
            throw new common_1.NotFoundException('Provider not found');
        if (viewerId) {
            this.interactions
                .record({ actorId: viewerId, type: 'VIEW_PROVIDER', entityType: 'PROVIDER', entityId: provider.id })
                .catch(() => undefined);
        }
        let distanceKm = null;
        let servesQueriedLocation = null;
        if (coords && provider.location) {
            const R = 6371;
            const dLat = ((coords.lat - provider.location.latitude) * Math.PI) / 180;
            const dLng = ((coords.lng - provider.location.longitude) * Math.PI) / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos((coords.lat * Math.PI) / 180) *
                    Math.cos((provider.location.latitude * Math.PI) / 180) *
                    Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distanceKm = Math.round(R * c * 10) / 10;
            servesQueriedLocation = distanceKm <= (provider.serviceRadiusKm ?? 0);
        }
        const safeProvider = { ...provider };
        if (safeProvider.user && 'email' in safeProvider.user)
            delete safeProvider.user.email;
        return { ...safeProvider, distanceKm, servesQueriedLocation };
    }
    async compare(ids) {
        if (ids.length === 0 || ids.length > 3)
            throw new common_1.BadRequestException('Compare between 1 and 3 providers');
        const providers = await this.prisma.provider.findMany({
            where: { id: { in: ids } },
            include: {
                user: { select: { phone: true, email: true, avatarUrl: true } },
                location: true,
                services: { where: { isActive: true }, include: { service: true }, orderBy: { createdAt: 'asc' } },
            },
        });
        if (providers.length !== ids.length)
            throw new common_1.NotFoundException('One or more providers were not found');
        const unique = [...new Set(ids)];
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
            const p = phone?.trim() ? phone.trim() : null;
            try {
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { phone: p },
                });
            } catch (e) { }
            try {
                await this.prisma.provider.update({
                    where: { id: provider.id },
                    data: { phone: p },
                });
            } catch (e) { }
        }
        return this.prisma.provider.update({
            where: { id: provider.id },
            data: {
                ...rest,
                ...(rest.logoUrl !== undefined ? { logoUrl: rest.logoUrl.trim() || null } : {}),
            },
        });
    }
};
exports.ProvidersService = ProvidersService;
