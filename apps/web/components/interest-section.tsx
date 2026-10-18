interface Interest {
  categoryId: string | null;
  categoryName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  effectiveScore: number;
}

function starsFor(score: number): number {
  if (score >= 20) return 5;
  if (score >= 12) return 4;
  if (score >= 6) return 3;
  if (score >= 3) return 2;
  return 1;
}

export function InterestSection({ interests }: { interests: Interest[] }) {
  if (interests.length === 0) {
    return <p className="text-sm text-ink-500">Keep browsing and we&rsquo;ll learn what you&rsquo;re interested in.</p>;
  }

  return (
    <ul className="space-y-2">
      {interests.map((i, idx) => (
        <li
          key={`${i.categoryId ?? ''}-${i.serviceId ?? idx}`}
          className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-surface px-3.5 py-2.5"
        >
          <span className="truncate text-sm font-medium text-ink-800">{i.serviceName ?? i.categoryName}</span>
          <span className="shrink-0 text-sm tracking-[0.1em] text-rating-400" aria-label={`Interest level ${starsFor(i.effectiveScore)} of 5`}>
            {'★'.repeat(starsFor(i.effectiveScore))}
            <span className="text-ink-200">{'★'.repeat(5 - starsFor(i.effectiveScore))}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
