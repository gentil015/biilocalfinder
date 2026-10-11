import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_RANKING_WEIGHTS, RankingWeights } from './recommendation.constants';

@Injectable()
export class RankingConfigService {
  constructor(private prisma: PrismaService) {}

  async getWeights(): Promise<RankingWeights> {
    const row = await this.prisma.rankingConfig.findFirst({ orderBy: { updatedAt: 'desc' } });
    if (!row) return DEFAULT_RANKING_WEIGHTS;

    const weights = { ...DEFAULT_RANKING_WEIGHTS, ...(row.weights as Partial<RankingWeights>) };
    // Normalize so the six factors always sum to 1, regardless of what an
    // admin entered — keeps the combined score comparable across configs.
    const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    return Object.fromEntries(
      Object.entries(weights).map(([k, v]) => [k, v / sum]),
    ) as unknown as RankingWeights;
  }

  async updateWeights(partial: Partial<RankingWeights>): Promise<RankingWeights> {
    const current = await this.getWeights();
    const merged = { ...current, ...partial };

    const existing = await this.prisma.rankingConfig.findFirst();
    if (existing) {
      await this.prisma.rankingConfig.update({ where: { id: existing.id }, data: { weights: merged } });
    } else {
      await this.prisma.rankingConfig.create({ data: { weights: merged } });
    }
    return merged;
  }
}
