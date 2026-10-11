import { RuleBasedRankingService } from './rule-based-ranking.service';
import { RankableProvider } from './provider-ranking.interface';

function baseProvider(overrides: Partial<RankableProvider> = {}): RankableProvider {
  return {
    id: '1',
    distanceKm: 5,
    rating: 4,
    availabilityStatus: 'AVAILABLE',
    responseRate: 80,
    yearsOfExperience: 5,
    verificationStatus: 'VERIFIED',
    subscriptionStatus: 'ACTIVE',
    ...overrides,
  };
}

describe('RuleBasedRankingService', () => {
  const ranking = new RuleBasedRankingService();

  it('ranks a closer provider above a farther one, all else equal', () => {
    const near = ranking.score(baseProvider({ distanceKm: 1 }));
    const far = ranking.score(baseProvider({ distanceKm: 40 }));
    expect(near).toBeGreaterThan(far);
  });

  it('ranks a higher-rated provider above a lower-rated one', () => {
    const good = ranking.score(baseProvider({ rating: 5 }));
    const bad = ranking.score(baseProvider({ rating: 2 }));
    expect(good).toBeGreaterThan(bad);
  });

  it('rewards verified and subscribed providers over unverified/free ones', () => {
    const verified = ranking.score(baseProvider({ verificationStatus: 'VERIFIED', subscriptionStatus: 'ACTIVE' }));
    const unverified = ranking.score(
      baseProvider({ verificationStatus: 'UNVERIFIED', subscriptionStatus: 'EXPIRED' }),
    );
    expect(verified).toBeGreaterThan(unverified);
  });

  it('treats an unknown distance as neutral rather than penalizing to zero', () => {
    const unknown = ranking.score(baseProvider({ distanceKm: null }));
    const veryFar = ranking.score(baseProvider({ distanceKm: 500 }));
    expect(unknown).toBeGreaterThan(veryFar);
  });

  it('ranks a semantically closer match above an otherwise-identical provider with no match', () => {
    const relevant = ranking.score(baseProvider({ semanticScore: 0.9 }));
    const irrelevant = ranking.score(baseProvider({ semanticScore: 0.1 }));
    const noSignal = ranking.score(baseProvider({ semanticScore: undefined }));
    expect(relevant).toBeGreaterThan(irrelevant);
    // A provider with no semantic signal at all (no query, or nothing
    // indexed) scores the same as before this field existed — it is
    // neither rewarded nor punished for the absence of a match.
    expect(noSignal).toBe(ranking.score(baseProvider()));
  });
});
