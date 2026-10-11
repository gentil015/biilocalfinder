import { RecommendationService } from './recommendation.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: any;
  let providerSearch: any;
  let rankingConfig: any;

  beforeEach(() => {
    prisma = {
      userInteraction: { count: jest.fn() },
      userInterest: { findMany: jest.fn().mockResolvedValue([]) },
      serviceCategory: { findMany: jest.fn().mockResolvedValue([]) },
      service: { findMany: jest.fn().mockResolvedValue([]) },
      serviceOffering: { findMany: jest.fn().mockResolvedValue([]) },
      serviceRequest: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    providerSearch = { search: jest.fn() };
    rankingConfig = {
      getWeights: jest.fn().mockResolvedValue({
        searchRelevance: 0.3,
        personalInterest: 0.2,
        distance: 0.15,
        rating: 0.15,
        availability: 0.1,
        providerQuality: 0.1,
      }),
    };
    service = new RecommendationService(prisma, providerSearch, rankingConfig);
  });

  describe('getColdStartStage', () => {
    it('classifies a brand new user with zero interactions as NEW', async () => {
      prisma.userInteraction.count.mockResolvedValue(0);
      expect(await service.getColdStartStage('user-1')).toBe('NEW');
    });

    it('classifies a user with a handful of interactions as SOME_ACTIVITY', async () => {
      prisma.userInteraction.count.mockResolvedValue(5);
      expect(await service.getColdStartStage('user-1')).toBe('SOME_ACTIVITY');
    });

    it('classifies a heavily active user as ESTABLISHED', async () => {
      prisma.userInteraction.count.mockResolvedValue(50);
      expect(await service.getColdStartStage('user-1')).toBe('ESTABLISHED');
    });
  });

  describe('recommendProviders', () => {
    it('returns nothing when the underlying search has no candidates (no crash on empty)', async () => {
      providerSearch.search.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
      const result = await service.recommendProviders({ userId: 'user-1' });
      expect(result).toEqual([]);
    });

    it("never queries another user's interests when scoring for this user", async () => {
      providerSearch.search.mockResolvedValue({
        items: [
          {
            id: 'provider-1',
            businessName: 'Acme',
            avatarUrl: null,
            rating: 4,
            reviewCount: 10,
            verificationStatus: 'VERIFIED',
            availabilityStatus: 'AVAILABLE',
            yearsOfExperience: 5,
            responseTimeMinutes: 30,
            distanceKm: 3,
            startingPrice: 1000,
            currency: 'RWF',
            latitude: 0,
            longitude: 0,
            score: 80,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      });

      await service.recommendProviders({ userId: 'user-1' });

      // Only ever called with the requesting user's own id — never another user's.
      expect(prisma.userInterest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('requests a generous candidate pool so a personalized match outside the top-rated few is never excluded before ranking', async () => {
      providerSearch.search.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });

      // A small explicit `limit` (what the caller wants returned) must not
      // shrink the candidate pool fetched for ranking — that was the bug:
      // the pool was derived from `limit * 3`, so asking for the top 10
      // recommendations only ever considered 30 candidates regardless of
      // how many providers actually matched.
      await service.recommendProviders({ userId: 'user-1', limit: 10 });

      const searchCallArgs = providerSearch.search.mock.calls[0][0];
      expect(searchCallArgs.limit).toBeGreaterThanOrEqual(200);
    });
  });

  describe('recommendServices — cold start fallback (spec §33)', () => {
    it('falls back to popular services when the user has no interest data', async () => {
      prisma.serviceRequest.groupBy.mockResolvedValue([]);
      prisma.service.findMany.mockResolvedValue([{ id: 'svc-1', name: 'Plumbing' }]);

      const result = await service.recommendServices({});

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].reason).toMatch(/popular/i);
    });
  });
});
