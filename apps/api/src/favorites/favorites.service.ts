import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteractionService } from '../personalization/interactions/interaction.service';

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private interactions: InteractionService,
  ) {}

  async add(userId: string, providerId: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new BadRequestException('Provider not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_providerId: { userId, providerId } },
    });
    if (existing) return existing;

    const favorite = await this.prisma.favorite.create({ data: { userId, providerId } });
    await this.interactions.record(userId, 'FAVORITE_PROVIDER', 'PROVIDER', providerId);
    return favorite;
  }

  async remove(userId: string, providerId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_providerId: { userId, providerId } },
    });
    if (!existing) throw new NotFoundException('Not favorited');
    await this.prisma.favorite.delete({ where: { id: existing.id } });
    await this.interactions.record(userId, 'UNFAVORITE_PROVIDER', 'PROVIDER', providerId);
    return { success: true };
  }

  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        provider: {
          include: { user: { select: { avatarUrl: true } }, location: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
