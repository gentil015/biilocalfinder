import {
  MatchRequestContext,
  MatchableOffering,
  MatchableProvider,
  buildCategoryDistances,
  haversineKm,
  keywordSimilarity,
  scoreProviderMatch,
  tokenize,
} from './provider-matching.scoring';

const provider = (overrides: Partial<MatchableProvider> = {}): MatchableProvider => ({
  id: 'prov-1',
  userId: 'user-1',
  businessName: 'Kigali Home Services',
  rating: 4.5,
  reviewCount: 12,
  verificationStatus: 'VERIFIED',
  businessVerified: false,
  availabilityStatus: 'AVAILABLE',
  subscriptionStatus: 'ACTIVE',
  yearsOfExperience: 5,
  responseRate: 90,
  responseTimeMinutes: 45,
  serviceRadiusKm: 15,
  location: { latitude: -1.9441, longitude: 30.0619 }, // Kigali
  serviceAreas: [],
  ...overrides,
});

const offering = (overrides: Partial<MatchableOffering> = {}): MatchableOffering => ({
  id: 'off-1',
  serviceId: 'service-plumbing',
  title: 'Emergency pipe repair',
  description: 'Leak and burst pipe repairs, same day.',
  basePrice: 25000,
  serviceName: 'Plumbing Repair',
  serviceDescription: 'General plumbing work',
  categoryId: 'cat-plumbing',
  categoryName: 'Plumbing',
  ...overrides,
});

function context(overrides: Partial<MatchRequestContext> = {}): MatchRequestContext {
  const text = 'Emergency pipe repair leaking tap in kitchen';
  return {
    serviceId: 'service-plumbing',
    text,
    tokens: tokenize(text),
    categoryDistances: new Map([
      ['cat-plumbing', 0],
      ['cat-home-repair', 1],
      ['cat-electrical', 2],
    ]),
    semanticSimilarity: null,
    location: { latitude: -1.9441, longitude: 30.0619 },
    budgetMin: 20000,
    budgetMax: 30000,
    ...overrides,
  };
}

describe('tokenize', () => {
  it('lowercases, drops stopwords and very short tokens', () => {
    const tokens = tokenize('I need a plumber for the leaking tap in my kitchen');
    expect(tokens.has('plumber')).toBe(true);
    expect(tokens.has('leaking')).toBe(true);
    expect(tokens.has('kitchen')).toBe(true);
    expect(tokens.has('the')).toBe(false);
    expect(tokens.has('in')).toBe(false);
  });
});

describe('keywordSimilarity', () => {
  it('scores overlapping words and reports which ones matched', () => {
    const result = keywordSimilarity(tokenize('leaking tap repair'), 'Emergency tap and pipe repair');
    expect(result.score).toBeGreaterThan(0);
    expect(result.matched).toEqual(expect.arrayContaining(['tap', 'repair']));
  });

  it('returns zero when nothing overlaps', () => {
    const result = keywordSimilarity(tokenize('wedding photographer'), 'Plumbing repair');
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
  });
});

describe('buildCategoryDistances', () => {
  const categories = [
    { id: 'root', parentId: null },
    { id: 'plumbing', parentId: 'root' },
    { id: 'electrical', parentId: 'root' },
    { id: 'pipe-install', parentId: 'plumbing' },
  ];

  it('walks up, down and across the category tree', () => {
    const distances = buildCategoryDistances('plumbing', categories);
    expect(distances.get('plumbing')).toBe(0);
    expect(distances.get('root')).toBe(1);
    expect(distances.get('pipe-install')).toBe(1);
    expect(distances.get('electrical')).toBe(2); // sibling via root
  });
});

describe('haversineKm', () => {
  it('is zero for the same point and increases with distance', () => {
    const kigali = { latitude: -1.9441, longitude: 30.0619 };
    const nearby = { latitude: -1.95, longitude: 30.07 };
    expect(haversineKm(kigali, kigali)).toBe(0);
    expect(haversineKm(kigali, nearby)).toBeGreaterThan(0);
    expect(haversineKm(kigali, nearby)).toBeLessThan(5);
  });
});

describe('scoreProviderMatch', () => {
  it('ranks exact service above same-category, and same-category above a distant relative', () => {
    const exact = scoreProviderMatch(provider(), offering(), context());
    const sameCategory = scoreProviderMatch(
      provider(),
      offering({ id: 'off-2', serviceId: 'service-drain', title: 'Drain cleaning', description: 'Blocked drains' }),
      context(),
    );
    const related = scoreProviderMatch(
      provider(),
      offering({
        id: 'off-3',
        serviceId: 'service-wiring',
        categoryId: 'cat-electrical',
        categoryName: 'Electrical',
        title: 'House wiring',
        description: 'Electrical installation',
      }),
      context(),
    );

    expect(exact.matchType).toBe('EXACT_SERVICE');
    expect(sameCategory.matchType).toBe('SAME_CATEGORY');
    expect(related.matchType).toBe('RELATED_CATEGORY');
    expect(exact.score).toBeGreaterThan(sameCategory.score);
    expect(sameCategory.score).toBeGreaterThan(related.score);
  });

  it('uses semantic similarity to rescue an offering outside the category family', () => {
    const unrelated = offering({
      id: 'off-semantic',
      serviceId: 'service-handyman',
      categoryId: 'cat-general',
      categoryName: 'General maintenance',
      title: 'Handyman visits',
      description: 'Fixes dripping taps and small leaks',
    });

    const withoutSemantic = scoreProviderMatch(provider(), unrelated, context({ semanticSimilarity: null }));
    const withSemantic = scoreProviderMatch(provider(), unrelated, context({ semanticSimilarity: 0.9 }));

    expect(withSemantic.score).toBeGreaterThan(withoutSemantic.score);
    expect(withSemantic.matchType).toBe('SEMANTIC');
  });

  it('rewards coverage of the requested area more than a far-away base', () => {
    const requestLocation = { latitude: -1.9441, longitude: 30.0619 };
    const nearby = scoreProviderMatch(
      provider({ serviceAreas: [{ latitude: -1.95, longitude: 30.07, radiusKm: 10 }] }),
      offering(),
      context({ location: requestLocation }),
    );
    const far = scoreProviderMatch(
      provider({
        location: { latitude: -2.5, longitude: 29.5 },
        serviceAreas: [],
      }),
      offering(),
      context({ location: requestLocation }),
    );

    expect(nearby.servesArea).toBe(true);
    expect(nearby.components.location).toBeGreaterThan(far.components.location);
  });

  it('gives a stronger budget score when the offering price fits the request range', () => {
    const fits = scoreProviderMatch(provider(), offering({ basePrice: 25000 }), context());
    const tooExpensive = scoreProviderMatch(provider(), offering({ basePrice: 200000 }), context());
    expect(fits.components.budget).toBeGreaterThan(tooExpensive.components.budget);
  });

  it('explains the match with human-readable reasons', () => {
    const result = scoreProviderMatch(provider(), offering(), context());
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'Offers Plumbing Repair',
        'Fits the budget',
        'Verified provider',
        'Available now',
      ]),
    );
  });
});
