import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { RecommendationReason } from './recommendation-reason';

interface ServiceLike {
  id: string;
  name: string;
  category?: { name: string };
}

export function RecommendedServiceCard({
  recommendation,
}: {
  recommendation: { reason?: string; data: ServiceLike };
}) {
  const service = recommendation.data;
  return (
    <Link
      href={`/search?serviceId=${service.id}`}
      className="surface-card-interactive group flex shrink-0 flex-col justify-between gap-6 p-4 sm:w-auto"
    >
      <RecommendationReason reason={recommendation.reason} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-950">{service.name}</p>
          {service.category?.name && (
            <p className="mt-0.5 truncate text-xs text-ink-500">{service.category.name}</p>
          )}
        </div>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
