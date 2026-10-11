import { InteractionType } from '@prisma/client';

// --- Interaction → interest weights (spec §6) ---
// Centralized here so no other file hardcodes a magic number for "how much
// does viewing a provider matter." Negative weights represent negative
// signals (unfavoriting, cancelling).
export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  SEARCH: 1,
  VIEW_SERVICE: 2,
  VIEW_PROVIDER: 2,
  VIEW_CATEGORY: 1,
  VIEW_QUOTE: 1,
  FAVORITE_PROVIDER: 4,
  UNFAVORITE_PROVIDER: -4,
  CREATE_SERVICE_REQUEST: 5,
  ACCEPT_QUOTE: 6,
  CREATE_BOOKING: 7,
  COMPLETE_BOOKING: 8,
  CANCEL_BOOKING: -3,
};

// Interaction types heavy/important enough to trigger an async
// recommendation-cache refresh via BullMQ rather than just a synchronous
// row upsert (spec §22: "for simple interactions, don't create
// unnecessary background jobs").
export const CACHE_INVALIDATING_INTERACTIONS: InteractionType[] = [
  'FAVORITE_PROVIDER',
  'UNFAVORITE_PROVIDER',
  'CREATE_SERVICE_REQUEST',
  'ACCEPT_QUOTE',
  'CREATE_BOOKING',
  'COMPLETE_BOOKING',
  'CANCEL_BOOKING',
];

// --- Recency decay (spec §7) ---
// effectiveScore = rawScore × recencyFactor(daysSinceLastInteraction)
// Simple exponential decay tuned to roughly match the spec's example
// checkpoints (today≈1.0, 1wk≈0.9, 1mo≈0.7, 3mo≈0.4, 6mo+≈low) — not
// meant to be exact, just a simple, explainable curve. No ML involved.
export const DECAY_RATE_PER_DAY = 0.0125;
export const MIN_DECAY_FACTOR = 0.05;

export function recencyFactor(daysSinceLastInteraction: number): number {
  const factor = Math.exp(-DECAY_RATE_PER_DAY * Math.max(0, daysSinceLastInteraction));
  return Math.max(MIN_DECAY_FACTOR, factor);
}

// Raw accumulated interest score that maps to a "full" 100-point interest
// signal. A handful of real interactions (a couple of searches plus a
// booking) reaches this comfortably; tune here, not inline in scoring code.
export const INTEREST_SCORE_CEILING = 30;

// --- Ranking weights (spec §10, §18, §34) ---
// Default weights for PersonalizedRankingService.recommendProviders(); the
// admin-configurable RankingConfig row overrides these without a deploy.
// The six factors match spec §18 exactly; percentages mirror spec §10
// with "response rate" and "experience" folded into providerQuality.
export interface RankingWeights {
  searchRelevance: number;
  personalInterest: number;
  distance: number;
  rating: number;
  availability: number;
  providerQuality: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  searchRelevance: 0.3,
  personalInterest: 0.2,
  distance: 0.15,
  rating: 0.15,
  availability: 0.1,
  providerQuality: 0.1,
};

// --- Avoiding filter bubbles (spec §32) ---
// Of the final providers/services shown on the personalized homepage,
// this fraction is genuinely personalized; the rest is popular/nearby/
// exploration, so a user is never trapped in one category.
export const PERSONALIZATION_MIX = {
  personalized: 0.6,
  popular: 0.2,
  nearby: 0.1,
  exploration: 0.1,
};

// --- Cold start (spec §33) ---
// Interaction-count thresholds that decide which of the three stages a
// user is in.
export const COLD_START_THRESHOLDS = {
  stage1MaxInteractions: 0, // brand new — no interactions at all
  stage2MaxInteractions: 10, // "some activity" — up to this many
  // above stage2MaxInteractions => stage 3, "established"
};

export const RECOMMENDATION_CACHE_TTL_SECONDS = 5 * 60;
export const RECOMMENDATION_CACHE_PREFIX = 'recommendations:user:';

// How many candidate providers PostgresProviderSearchService fetches
// before RecommendationService applies its own personalized re-ranking.
// This MUST be generous: if it's too small, the best personalized match
// can rank outside the SQL-side cutoff and never even reach the ranking
// step — e.g. with 500 matching providers and a candidate pool of only
// 30, the #47-best-rated provider (who might be the #1 personalized
// match) never gets scored at all. For a realistic V1 marketplace size
// (dozens to low hundreds of providers per service/category) this cap is
// generous enough to cover virtually the whole filtered set. The real
// long-term fix is a proper candidate/ranking pipeline backed by
// OpenSearch (spec §51) rather than a single SQL LIMIT; this constant is
// the documented, adjustable stopgap until then.
export const RECOMMENDATION_CANDIDATE_POOL_SIZE = 300;

export const RECENTLY_VIEWED_LIMIT = 5;
export const RECENT_SEARCHES_LIMIT = 5;
export const MIN_INTEREST_SCORE_TO_SURFACE = 3; // below this, a section is hidden rather than shown near-empty (spec §8)

// Provider-facing demand insights (spec §15) never surface a raw
// per-interaction count — only an aggregate across at least this many
// distinct users, so a single person's activity is never identifiable.
export const MIN_DEMAND_USERS_TO_SURFACE = 3;
