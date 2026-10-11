import { Injectable } from '@nestjs/common';
import { ProviderRankingService, RankableProvider } from './provider-ranking.interface';

// Weighted sum of relevance signals, per spec §9:
//   Relevance + Distance + Rating + Availability + Response rate + Experience
// Weights are intentionally simple and easy to reason about; a future
// ML-based ranker can replace this without touching any caller.
@Injectable()
export class RuleBasedRankingService implements ProviderRankingService {
  score(provider: RankableProvider): number {
    let score = 0;

    // Distance: closer is better. 0km -> 30pts, decays to 0 by 50km.
    if (provider.distanceKm != null) {
      score += Math.max(0, 30 - provider.distanceKm * 0.6);
    } else {
      score += 10; // unknown distance (no location set) — neutral
    }

    // Rating: 0-5 stars -> 0-25pts.
    score += (provider.rating / 5) * 25;

    // Availability: available now is worth a solid bump.
    if (provider.availabilityStatus === 'AVAILABLE') score += 15;
    else if (provider.availabilityStatus === 'BUSY') score += 5;

    // Response rate: 0-100% -> 0-15pts.
    score += (provider.responseRate / 100) * 15;

    // Experience: diminishing returns after ~10 years.
    score += Math.min(10, provider.yearsOfExperience) * 1;

    // Verification and active subscription both boost visibility, per
    // spec §9 ("Subscription tier where appropriate") and §56.
    if (provider.verificationStatus === 'VERIFIED') score += 10;
    if (provider.subscriptionStatus === 'ACTIVE') score += 5;

    // Semantic relevance (pgvector cosine similarity to the search query,
    // when one was given): 0-1 -> 0-20pts. Only added when present, so a
    // plain browse/filter search (no `q`, semanticScore undefined) scores
    // exactly as it did before this field existed.
    if (provider.semanticScore != null) {
      score += provider.semanticScore * 20;
    }

    return score;
  }
}
