import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecommendationService } from './recommendation/recommendation.service';
import { RecommendationCacheService } from './recommendation-cache.service';
import { PreferenceService } from './preferences/preference.service';
import { ProviderAnalyticsService } from './analytics/provider-analytics.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { RECENTLY_VIEWED_LIMIT } from './recommendation/recommendation.constants';

interface HomeParams {
  userId: string;
  firstName: string;
  lat?: number;
  lng?: number;
}

@Injectable()
export class PersonalizationService {
  constructor(
    private prisma: PrismaService,
    private recommendation: RecommendationService,
    private cache: RecommendationCacheService,
    private preferences: PreferenceService,
    private analytics: ProviderAnalyticsService,
    private providerContext: ProviderContextService,
  ) {}

  async getHome(params: HomeParams) {
    const preference = await this.preferences.get(params.userId);
    const personalizationEnabled = preference.personalizationEnabled;
    const locationEnabled = personalizationEnabled && preference.locationBasedEnabled && params.lat != null && params.lng != null;

    const stage = personalizationEnabled
      ? await this.recommendation.getColdStartStage(params.userId)
      : 'NEW'; // personalization off behaves like a brand-new user: generic only

    const sections: Record<string, unknown> = {};

    if (stage === 'NEW') {
      // Stage 1 (spec §33): popular + nearby + highly rated + available —
      // never an empty personalized homepage for a new user (spec §9).
      const [popularServices, popularProviders] = await Promise.all([
        this.recommendation.recommendServices({ limit: 6 }),
        this.recommendation.recommendProviders({ lat: params.lat, lng: params.lng, limit: 6 }),
      ]);
      if (popularServices.length) sections.popularServices = popularServices;
      if (popularProviders.length) sections.highlyRatedProviders = popularProviders;
    } else {
      let recommendedProviders = await this.cache.get<unknown[]>(params.userId, 'providers');
      if (!recommendedProviders) {
        const recs = await this.recommendation.recommendProviders({
          userId: params.userId,
          lat: locationEnabled ? params.lat : undefined,
          lng: locationEnabled ? params.lng : undefined,
          limit: 6,
        });
        recommendedProviders = recs;
        if (recs.length) {
          await this.cache.set(
            params.userId,
            'providers',
            recs.map((r) => r.entityId),
            recs,
          );
        }
      }
      if ((recommendedProviders as unknown[]).length) sections.recommendedProviders = recommendedProviders;

      const topInterest = await this.recommendation.getTopCategoryInterest(params.userId);
      if (topInterest?.categoryId) {
        const services = await this.prisma.service.findMany({
          where: { categoryId: topInterest.categoryId, isActive: true },
          take: 4,
        });
        if (services.length) {
          sections.becauseYouViewed = { categoryName: topInterest.categoryName, services };
        }
      }

      if (locationEnabled) {
        const nearby = await this.recommendation.recommendProviders({
          lat: params.lat,
          lng: params.lng,
          limit: 4,
        });
        if (nearby.length) sections.nearbyProviders = nearby;
      }

      if (preference.recentlyViewedEnabled) {
        const recentlyViewed = await this.getRecentlyViewedProviders(params.userId);
        if (recentlyViewed.length) sections.recentlyViewed = recentlyViewed;
      }
    }

    return {
      greeting: `Good to see you, ${params.firstName}`,
      personalizationEnabled,
      coldStartStage: stage,
      sections,
    };
  }

  // --- Provider dashboard insights (spec §14, extended by spec §8 — the
  // "growth assistant") ---
  // Simple, transparent rules — not a model, not user-specific data from
  // any other provider or client. Each check is independent and cheap.
  async getProviderInsights(providerUserId: string) {
    // Was `prisma.provider.findUnique({ where: { userId } })` — invalid now
    // that Provider.userId isn't @unique (manual-sql/010), so it threw at
    // runtime and 500'd. Resolve via ProviderContextService, then re-fetch by
    // id to attach the relations the rules below read. Falls back to the
    // empty result this method already returns for a provider with no profile.
    const resolved = await this.providerContext.resolveForUser(providerUserId).catch(() => null);
    if (!resolved) return { recommendedActions: [], opportunities: [], profileStrength: { percent: 0, checklist: [] } };

    const provider = await this.prisma.provider.findUniqueOrThrow({
      where: { id: resolved.id },
      include: {
        user: { select: { phoneVerified: true } },
        services: true,
        portfolios: { include: { images: true } },
        availabilities: true,
      },
    });

    const recommendedActions: { action: string; label: string }[] = [];
    const portfolioImageCount = provider.portfolios.reduce(
      (sum: number, p: (typeof provider.portfolios)[number]) => sum + p.images.length,
      0,
    );
    const hasPricing = provider.services.some((s: (typeof provider.services)[number]) => s.basePrice != null);

    if (portfolioImageCount === 0) {
      recommendedActions.push({ action: 'ADD_PORTFOLIO', label: 'Add photos of your past work to build trust' });
    }
    if (provider.services.length < 2) {
      recommendedActions.push({ action: 'ADD_SERVICES', label: 'Add more services to reach more clients' });
    }
    if (provider.availabilities.length === 0) {
      recommendedActions.push({ action: 'SET_AVAILABILITY', label: 'Set your weekly availability' });
    }
    if (provider.verificationStatus === 'UNVERIFIED') {
      recommendedActions.push({ action: 'GET_VERIFIED', label: 'Get verified to stand out in search results' });
    }

    // Profile strength (spec §8) — a plain checklist, each item weighted
    // equally. Portfolio/pricing/availability are "nice to have" (⚠) while
    // the first four are the baseline every provider is expected to have (✓).
    const PORTFOLIO_TARGET_IMAGES = 3;
    const checklist = [
      { id: 'DESCRIPTION', label: 'Business description', checked: !!provider.description?.trim() },
      { id: 'PHONE_VERIFIED', label: 'Phone verification', checked: provider.user.phoneVerified },
      { id: 'LOCATION', label: 'Location', checked: !!provider.locationId },
      { id: 'SERVICES', label: 'Services', checked: provider.services.length > 0 },
      {
        id: 'PORTFOLIO',
        label: `Add ${Math.max(PORTFOLIO_TARGET_IMAGES - portfolioImageCount, 0)} more portfolio images`,
        checked: portfolioImageCount >= PORTFOLIO_TARGET_IMAGES,
      },
      { id: 'AVAILABILITY', label: 'Add your availability', checked: provider.availabilities.length > 0 },
      { id: 'PRICING', label: 'Add pricing', checked: hasPricing },
    ];
    const percent = Math.round((checklist.filter((c) => c.checked).length / checklist.length) * 100);

    // Analytics-informed nudge: real traffic isn't converting into contact
    // (spec §7-8 tie-in — "People are viewing your profile but not
    // contacting you" → "Consider adding more portfolio photos").
    const monthly = await this.analytics.getMonthlySummary(providerUserId);
    if (monthly.profileViews >= 10 && monthly.requests === 0) {
      recommendedActions.push({
        action: 'IMPROVE_CONVERSION',
        label: 'People are viewing your profile but not contacting you — consider adding more portfolio photos',
      });
    }

    const opportunities = await this.recommendation.getProviderOpportunities(provider.id);

    return { recommendedActions, opportunities, profileStrength: { percent, checklist } };
  }

  async getRecentlyViewedProviders(userId: string) {
    const interactions = await this.prisma.userInteraction.findMany({
      where: { userId, type: 'VIEW_PROVIDER', entityType: 'PROVIDER' },
      orderBy: { createdAt: 'desc' },
      take: RECENTLY_VIEWED_LIMIT * 3, // a provider may be viewed multiple times — de-dupe below
    });

    const orderedIds: string[] = [];
    for (const i of interactions) {
      if (i.entityId && !orderedIds.includes(i.entityId)) orderedIds.push(i.entityId);
      if (orderedIds.length >= RECENTLY_VIEWED_LIMIT) break;
    }
    if (orderedIds.length === 0) return [];

    const providers = await this.prisma.provider.findMany({
      // Same publishing gate as search/compare/public profile — a
      // recently-viewed card is still a public surface.
      where: { id: { in: orderedIds }, onboardingStep: 'COMPLETED' },
      include: { user: { select: { avatarUrl: true } }, location: true },
    });
    const byId = new Map(providers.map((p: (typeof providers)[number]) => [p.id, p]));
    return orderedIds.map((id) => byId.get(id)).filter((p): p is (typeof providers)[number] => !!p);
  }
}
