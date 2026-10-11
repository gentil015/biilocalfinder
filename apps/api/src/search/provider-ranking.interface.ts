export interface RankableProvider {
  id: string;
  distanceKm: number | null;
  rating: number;
  availabilityStatus: string;
  responseRate: number;
  yearsOfExperience: number;
  verificationStatus: string;
  subscriptionStatus: string;
  // 0 (unrelated) to 1 (near-identical meaning) similarity between the
  // search query and this provider's best-matching offering, from pgvector
  // cosine distance. Undefined/null whenever there was no text query, no
  // embedding provider available, or this provider has no indexed
  // offering — callers must treat all three the same as "no signal" rather
  // than as 0 (which would unfairly penalize an unembedded provider).
  semanticScore?: number | null;
}

// Both the rule-based ranker (Phase 3) and a future ML ranker (Phase "future
// AI") implement this same interface, so `PostgresProviderSearchService`
// and the controller never need to change when the ranking strategy does
// (spec §9: "Create the ranking logic as a separate service so an ML
// ranking system can replace it later.").
export interface ProviderRankingService {
  score(provider: RankableProvider): number;
}
