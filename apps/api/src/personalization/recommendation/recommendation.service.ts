import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROVIDER_SEARCH_SERVICE, ProviderSearchService } from '../../search/provider-search.interface';
import { RankingConfigService } from './ranking-config.service';
import {
  COLD_START_THRESHOLDS,
  INTEREST_SCORE_CEILING,
  MIN_DEMAND_USERS_TO_SURFACE,
  MIN_INTEREST_SCORE_TO_SURFACE,
  RECOMMENDATION_CANDIDATE_POOL_SIZE,
  recencyFactor,
} from './recommendation.constants';
import {
  ColdStartStage,
  InterestSummary,
  Recommendation,
  RecommendationContext,
  RecommendationEngine,
} from './recommendation.types';

@Injectable()
export class RecommendationService implements RecommendationEngine {
  constructor(
    private prisma: PrismaService,
    @Inject(PROVIDER_SEARCH_SERVICE) private providerSearch: ProviderSearchService,
    private rankingConfig: RankingConfigService,
  ) {}

  // --- Cold start (spec §33) ---

  async getColdStartStage(userId: string): Promise<ColdStartStage> {
    const count = await this.prisma.userInteraction.count({ where: { userId } });
    if (count <= COLD_START_THRESHOLDS.stage1MaxInteractions) return 'NEW';
    if (count <= COLD_START_THRESHOLDS.stage2MaxInteractions) return 'SOME_ACTIVITY';
    return 'ESTABLISHED';
  }

  // --- Interests (spec §5, §12; backs GET /personalization/interests) ---

  async getInterestSummary(userId: string, limit = 10): Promise<InterestSummary[]> {
    const rows = await this.prisma.userInterest.findMany({
      where: { userId },
      orderBy: { score: 'desc' },
      take: limit * 2, // fetch extra since decay can reorder before we cap
    });

    type InterestRow = (typeof rows)[number];
    const categoryIds = [
      ...new Set(rows.map((r: InterestRow) => r.categoryId).filter((id: string | null): id is string => !!id)),
    ];
    const serviceIds = [
      ...new Set(rows.map((r: InterestRow) => r.serviceId).filter((id: string | null): id is string => !!id)),
    ];

    const [categories, services] = await Promise.all([
      categoryIds.length
        ? this.prisma.serviceCategory.findMany({ where: { id: { in: categoryIds } } })
        : Promise.resolve([]),
      serviceIds.length
        ? this.prisma.service.findMany({ where: { id: { in: serviceIds } } })
        : Promise.resolve([]),
    ]);
    const categoryName = new Map(categories.map((c: (typeof categories)[number]) => [c.id, c.name]));
    const serviceName = new Map(services.map((s: (typeof services)[number]) => [s.id, s.name]));

    return rows
      .map((r: InterestRow) => {
        const days = (Date.now() - r.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
        return {
          categoryId: r.categoryId,
          categoryName: r.categoryId ? (categoryName.get(r.categoryId) ?? null) : null,
          serviceId: r.serviceId,
          serviceName: r.serviceId ? (serviceName.get(r.serviceId) ?? null) : null,
          effectiveScore: r.score * recencyFactor(days),
        };
      })
      .filter((r: InterestSummary) => r.effectiveScore >= MIN_INTEREST_SCORE_TO_SURFACE)
      .sort((a: InterestSummary, b: InterestSummary) => b.effectiveScore - a.effectiveScore)
      .slice(0, limit);
  }

  async getTopCategoryInterest(userId: string): Promise<InterestSummary | null> {
    const summary = await this.getInterestSummary(userId, 1);
    return summary[0] ?? null;
  }

  // --- Provider recommendations (spec §10, §18) ---

  async recommendProviders(context: RecommendationContext): Promise<Recommendation[]> {
    const limit = context.limit ?? 10;

    const candidates = await this.providerSearch.search({
      serviceId: context.serviceId,
      categoryId: context.categoryId,
      lat: context.lat,
      lng: context.lng,
      radiusKm: context.radiusKm,
      q: context.query,
      page: 1,
      // Over-fetch a generous candidate pool, re-rank all of it here, then
      // cut down to `limit` — see RECOMMENDATION_CANDIDATE_POOL_SIZE for
      // why this can't just be `limit * 3` (a real bug: the best
      // personalized match could rank outside a too-small SQL cutoff and
      // never reach the ranking step at all).
      limit: RECOMMENDATION_CANDIDATE_POOL_SIZE,
      sort: 'recommended',
    });

    if (candidates.items.length === 0) return [];

    const interestByKey = context.userId ? await this.interestLookup(context.userId) : new Map<string, number>();
    const providerRefs = await this.providerCategoryServiceRefs(candidates.items.map((c) => c.id));
    const weights = await this.rankingConfig.getWeights();
    const topInterest = context.userId ? await this.getTopCategoryInterest(context.userId) : null;

    const scored = candidates.items.map((item) => {
      const refs = providerRefs.get(item.id) ?? [];
      const personalInterest = this.personalInterestScore(refs, interestByKey);
      const relevance = this.searchRelevanceScore(context, refs);
      const distance = this.distanceScore(item.distanceKm);
      const rating = (item.rating / 5) * 100;
      const availability = this.availabilityScore(item.availabilityStatus);
      const quality = this.providerQualityScore(item.verificationStatus, item.yearsOfExperience, item.responseTimeMinutes);

      const score =
        weights.searchRelevance * relevance +
        weights.personalInterest * personalInterest +
        weights.distance * distance +
        weights.rating * rating +
        weights.availability * availability +
        weights.providerQuality * quality;

      return {
        entityId: item.id,
        score,
        reason: this.reasonForProvider(context, topInterest, item.distanceKm),
        data: item,
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // --- Service recommendations (spec §11) ---

  async recommendServices(context: RecommendationContext): Promise<Recommendation[]> {
    const limit = context.limit ?? 6;
    const interests = context.userId ? await this.getInterestSummary(context.userId, limit) : [];

    const interestServiceIds = interests
      .map((i: InterestSummary) => i.serviceId)
      .filter((id): id is string => !!id);

    const [interestServices, popularServices] = await Promise.all([
      interestServiceIds.length
        ? this.prisma.service.findMany({ where: { id: { in: interestServiceIds }, isActive: true } })
        : Promise.resolve([]),
      this.popularServices(limit),
    ]);
    type ServiceRow = (typeof interestServices)[number];

    const seen = new Set(interestServices.map((s: ServiceRow) => s.id));
    const recommendations: Recommendation[] = interestServices.map((s: ServiceRow) => ({
      entityId: s.id,
      score: 100,
      reason: 'Because of your recent activity',
      data: s,
    }));

    // Fill the rest with popular services, never showing the same service
    // twice, and never trapping the user in only their existing interests
    // (spec §32 — avoid filter bubbles).
    for (const s of popularServices as ServiceRow[]) {
      if (recommendations.length >= limit) break;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      recommendations.push({ entityId: s.id, score: 50, reason: 'Popular on Bii Localfinder', data: s });
    }

    return recommendations.slice(0, limit);
  }

  private async popularServices(limit: number) {
    const grouped = await this.prisma.serviceRequest.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: limit,
    });
    type GroupRow = (typeof grouped)[number];

    if (grouped.length === 0) {
      // Empty platform / no requests yet — just return some active services.
      return this.prisma.service.findMany({ where: { isActive: true }, take: limit });
    }

    const services = await this.prisma.service.findMany({
      where: { id: { in: grouped.map((g: GroupRow) => g.serviceId) }, isActive: true },
    });
    type ServiceRow = (typeof services)[number];

    const order = new Map<string, number>(grouped.map((g: GroupRow, i: number) => [g.serviceId, i]));
    return services.sort(
      (a: ServiceRow, b: ServiceRow) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );
  }

  // --- Provider demand insights (spec §15) ---
  // Each row in UserInterest is exactly one user's aggregated interest in
  // one service (enforced by the (userId, categoryId, serviceId) unique
  // constraint), so grouping by serviceId and counting rows is naturally a
  // distinct-user count — never an individual's identity or raw activity,
  // and only surfaced once it clears MIN_DEMAND_USERS_TO_SURFACE.
  async getProviderOpportunities(providerId: string, limit = 3) {
    const offered = await this.prisma.serviceOffering.findMany({ where: { providerId }, select: { serviceId: true } });
    const offeredIds = offered.map((o: (typeof offered)[number]) => o.serviceId);

    const grouped = await this.prisma.userInterest.groupBy({
      by: ['serviceId'],
      where: { serviceId: { not: null, notIn: offeredIds.length ? offeredIds : undefined } },
      _count: { _all: true },
    });
    type GroupRow = (typeof grouped)[number];

    const qualifying = grouped
      .filter((g: GroupRow) => g._count._all >= MIN_DEMAND_USERS_TO_SURFACE)
      .sort((a: GroupRow, b: GroupRow) => b._count._all - a._count._all)
      .slice(0, limit);

    if (qualifying.length === 0) return [];

    const services = await this.prisma.service.findMany({
      where: { id: { in: qualifying.map((g: GroupRow) => g.serviceId as string) } },
      include: { category: true },
    });
    const countByService = new Map(qualifying.map((g: GroupRow) => [g.serviceId, g._count._all]));

    return services.map((s: (typeof services)[number]) => ({
      serviceId: s.id,
      serviceName: s.name,
      categoryName: s.category.name,
      approximateInterestedUsers: countByService.get(s.id) ?? 0,
    }));
  }

  // --- Scoring components (spec §18 — kept separate and named exactly so
  // any one can be swapped or replaced by an ML model later) ---

  private distanceScore(distanceKm: number | null): number {
    if (distanceKm == null) return 50; // no location context — neutral
    return Math.max(0, 100 - distanceKm * 2); // 0km=100, 50km=0
  }

  private availabilityScore(status: string): number {
    if (status === 'AVAILABLE') return 100;
    if (status === 'BUSY') return 40;
    return 0;
  }

  private providerQualityScore(
    verificationStatus: string,
    yearsOfExperience: number,
    responseTimeMinutes: number | null,
  ): number {
    let score = verificationStatus === 'VERIFIED' ? 50 : 20;
    score += Math.min(30, yearsOfExperience * 3);
    if (responseTimeMinutes != null) score += responseTimeMinutes <= 60 ? 20 : 10;
    return Math.min(100, score);
  }

  private searchRelevanceScore(
    context: RecommendationContext,
    refs: { categoryId: string | null; serviceId: string | null }[],
  ): number {
    if (context.serviceId && refs.some((r) => r.serviceId === context.serviceId)) return 100;
    if (context.categoryId && refs.some((r) => r.categoryId === context.categoryId)) return 70;
    if (!context.serviceId && !context.categoryId && !context.query) return 50; // generic browse/home context
    return 40;
  }

  private personalInterestScore(
    refs: { categoryId: string | null; serviceId: string | null }[],
    interestByKey: Map<string, number>,
  ): number {
    if (refs.length === 0 || interestByKey.size === 0) return 0;
    let raw = 0;
    for (const ref of refs) {
      if (ref.serviceId) raw += interestByKey.get(`service:${ref.serviceId}`) ?? 0;
      if (ref.categoryId) raw += interestByKey.get(`category:${ref.categoryId}`) ?? 0;
    }
    return Math.max(0, Math.min(100, (raw / INTEREST_SCORE_CEILING) * 100));
  }

  private reasonForProvider(
    context: RecommendationContext,
    topInterest: InterestSummary | null,
    distanceKm: number | null,
  ): string {
    if (context.query) return `Matches your search for "${context.query}"`;
    if (topInterest?.categoryName) return `Because you're interested in ${topInterest.categoryName}`;
    if (distanceKm != null && distanceKm < 5) return 'Nearby and available';
    return 'Recommended for you';
  }

  // userId:type key -> decayed effective score, for O(1) lookup while scoring candidates.
  private async interestLookup(userId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.userInterest.findMany({ where: { userId } });
    const map = new Map<string, number>();
    for (const r of rows) {
      const days = (Date.now() - r.lastInteractionAt.getTime()) / (1000 * 60 * 60 * 24);
      const effective = r.score * recencyFactor(days);
      if (r.serviceId) map.set(`service:${r.serviceId}`, effective);
      if (r.categoryId && !r.serviceId) map.set(`category:${r.categoryId}`, effective);
    }
    return map;
  }

  private async providerCategoryServiceRefs(
    providerIds: string[],
  ): Promise<Map<string, { categoryId: string | null; serviceId: string | null }[]>> {
    const rows = await this.prisma.serviceOffering.findMany({
      where: { providerId: { in: providerIds } },
      include: { service: true },
    });
    const map = new Map<string, { categoryId: string | null; serviceId: string | null }[]>();
    for (const row of rows) {
      const list = map.get(row.providerId) ?? [];
      list.push({ categoryId: row.service.categoryId, serviceId: row.serviceId });
      map.set(row.providerId, list);
    }
    return map;
  }
}
