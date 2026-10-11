import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedSearchDto } from './dto/create-saved-search.dto';

const MAX_SAVED_SEARCHES_PER_USER = 20;

@Injectable()
export class SavedSearchesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateSavedSearchDto) {
    if (!dto.serviceId && !dto.categoryId && !dto.city) {
      throw new BadRequestException('Add at least a service, category, or city to save this search');
    }
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service) throw new NotFoundException('Service not found');
    }
    if (dto.categoryId) {
      const category = await this.prisma.serviceCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw new NotFoundException('Category not found');
    }

    const count = await this.prisma.savedSearch.count({ where: { userId, isActive: true } });
    if (count >= MAX_SAVED_SEARCHES_PER_USER) {
      throw new BadRequestException(`You can save up to ${MAX_SAVED_SEARCHES_PER_USER} searches`);
    }

    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        serviceId: dto.serviceId,
        categoryId: dto.categoryId,
        city: dto.city,
        verifiedOnly: dto.verifiedOnly ?? false,
        maxPrice: dto.maxPrice,
      },
    });
  }

  async findMine(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId, isActive: true },
      include: { service: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const search = await this.prisma.savedSearch.findUnique({ where: { id } });
    if (!search || search.userId !== userId) throw new ForbiddenException('Not found');
    // Soft delete: keeps history for the sweep's own bookkeeping without
    // a foreign-key cleanup step, same rationale as elsewhere in this app.
    await this.prisma.savedSearch.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }

  // Providers eligible for one saved search, created since it was last
  // checked. "New" here specifically means a newly-signed-up provider
  // that matches — not an existing provider who edited their offerings to
  // now match, which would need a very different (and much noisier)
  // change-detection story to do well; scoped out for this pass.
  async findNewMatches(search: Prisma.SavedSearchGetPayload<{}>) {
    const since = search.lastNotifiedAt ?? search.createdAt;

    const where: Prisma.ProviderWhereInput = {
      createdAt: { gt: since },
      subscriptionStatus: { not: 'EXPIRED' },
      onboardingStep: 'COMPLETED', // never notify about a still-onboarding provider
      ...(search.verifiedOnly ? { verificationStatus: 'VERIFIED' } : {}),
      ...(search.city ? { location: { city: { equals: search.city, mode: 'insensitive' } } } : {}),
      services: {
        some: {
          isActive: true,
          ...(search.serviceId ? { serviceId: search.serviceId } : {}),
          ...(search.categoryId ? { service: { categoryId: search.categoryId } } : {}),
          ...(search.maxPrice != null ? { basePrice: { lte: search.maxPrice } } : {}),
        },
      },
    };

    return this.prisma.provider.findMany({ where, select: { id: true, businessName: true }, take: 10 });
  }
}
