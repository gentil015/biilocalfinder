import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { AddPortfolioImageDto } from './dto/add-portfolio-image.dto';

const PORTFOLIO_INCLUDE = {
  service: { include: { category: true } },
  images: { orderBy: { position: 'asc' as const } },
} as const;

@Injectable()
export class PortfolioService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
    private providerContext: ProviderContextService,
  ) {}

  async create(userId: string, dto: CreatePortfolioDto) {
    const provider = await this.getProvider(userId);
    if (dto.serviceId) await this.assertOwnService(provider.id, dto.serviceId);
    return this.prisma.portfolio.create({
      data: {
        providerId: provider.id,
        title: dto.title,
        description: dto.description,
        serviceId: dto.serviceId,
        projectDate: dto.projectDate ? new Date(dto.projectDate) : undefined,
      },
      include: PORTFOLIO_INCLUDE,
    });
  }

  async findMine(userId: string) {
    const provider = await this.getProvider(userId);
    return this.prisma.portfolio.findMany({
      where: { providerId: provider.id },
      include: PORTFOLIO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, portfolioId: string, dto: UpdatePortfolioDto) {
    const provider = await this.getProvider(userId);
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio || portfolio.providerId !== provider.id) throw new NotFoundException('Portfolio not found');
    if (dto.serviceId) await this.assertOwnService(provider.id, dto.serviceId);
    return this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        title: dto.title,
        description: dto.description,
        serviceId: dto.serviceId,
        projectDate: dto.projectDate ? new Date(dto.projectDate) : undefined,
      },
      include: PORTFOLIO_INCLUDE,
    });
  }

  async remove(userId: string, portfolioId: string) {
    const provider = await this.getProvider(userId);
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio || portfolio.providerId !== provider.id) throw new NotFoundException('Portfolio not found');
    await this.prisma.portfolio.delete({ where: { id: portfolioId } });
    return { success: true };
  }

  async addImage(userId: string, portfolioId: string, dto: AddPortfolioImageDto) {
    const provider = await this.getProvider(userId);
    const portfolio = await this.prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio || portfolio.providerId !== provider.id) throw new NotFoundException('Portfolio not found');

    // A before/after upload must arrive in a BEFORE+AFTER pair sharing one
    // group key — half a pair is just a confusing, unlabeled photo.
    if ((dto.beforeAfterRole && !dto.beforeAfterGroup) || (dto.beforeAfterGroup && !dto.beforeAfterRole)) {
      throw new BadRequestException('beforeAfterRole and beforeAfterGroup must be set together');
    }

    // Centralized plan-based entitlement (spec §7) — replaces the old
    // hardcoded "3 free, then require ACTIVE subscription" check with a
    // real per-plan, per-type limit lookup. Applies across photos and
    // videos alike — a provider's total media count, not just images.
    await this.entitlements.assertCanAdd(provider, 'portfolioItems');

    const position = await this.prisma.portfolioImage.count({ where: { portfolioId } });
    return this.prisma.portfolioImage.create({
      data: {
        portfolioId,
        url: dto.url,
        storageKey: dto.storageKey,
        mediaType: dto.mediaType ?? 'IMAGE',
        beforeAfterRole: dto.beforeAfterRole,
        beforeAfterGroup: dto.beforeAfterGroup,
        position,
      },
    });
  }

  async removeImage(userId: string, imageId: string) {
    const provider = await this.getProvider(userId);
    const image = await this.prisma.portfolioImage.findUnique({
      where: { id: imageId },
      include: { portfolio: true },
    });
    if (!image || image.portfolio.providerId !== provider.id) throw new NotFoundException('Image not found');
    await this.prisma.portfolioImage.delete({ where: { id: imageId } });
    return { success: true };
  }

  private async assertOwnService(providerId: string, serviceId: string) {
    const offering = await this.prisma.serviceOffering.findUnique({
      where: { providerId_serviceId: { providerId, serviceId } },
    });
    if (!offering) throw new BadRequestException('You can only tag a portfolio project to a service you offer');
  }

  private async getProvider(userId: string) {
    return this.providerContext.resolveForUser(userId);
  }
}
