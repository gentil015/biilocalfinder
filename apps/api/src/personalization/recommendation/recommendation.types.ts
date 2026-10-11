export interface RecommendationContext {
  userId?: string;
  serviceId?: string;
  categoryId?: string;
  query?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
}

export interface Recommendation<T = unknown> {
  entityId: string;
  score: number;
  reason?: string; // human-readable "because you..." explanation (spec §13)
  data: T;
}

// V1 is RuleBasedRecommendationEngine. A future MLRecommendationEngine
// (e.g. XGBoostRecommendationEngine) implements the exact same interface
// so the rest of the app — controllers, the personalized homepage, search
// — never changes when the engine behind it does (spec §36-37).
export interface RecommendationEngine {
  recommendProviders(context: RecommendationContext): Promise<Recommendation[]>;
  recommendServices(context: RecommendationContext): Promise<Recommendation[]>;
}

export const RECOMMENDATION_ENGINE = 'RECOMMENDATION_ENGINE';

export type ColdStartStage = 'NEW' | 'SOME_ACTIVITY' | 'ESTABLISHED';

export interface InterestSummary {
  categoryId: string | null;
  categoryName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  effectiveScore: number;
}
