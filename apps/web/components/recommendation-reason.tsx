export function RecommendationReason({ reason }: { reason?: string }) {
  if (!reason) return null;
  // "Why am I seeing this?" has to be visually subordinate to the card it
  // explains, so it reads as a caption rather than a headline.
  return <p className="mb-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-400">{reason}</p>;
}
