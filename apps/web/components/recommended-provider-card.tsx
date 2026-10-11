import { ProviderCard } from './provider-card';
import { RecommendationReason } from './recommendation-reason';
import type { ProviderSearchItem } from '@/lib/api';

export function RecommendedProviderCard({ recommendation }: { recommendation: { reason?: string; data: ProviderSearchItem } }) {
  return (
    <div className="w-72 shrink-0 sm:w-auto">
      <RecommendationReason reason={recommendation.reason} />
      <ProviderCard provider={recommendation.data} />
    </div>
  );
}
