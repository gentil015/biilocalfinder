/**
 * Mirrors ProviderCard's geometry exactly (16/20px padding, 72px avatar,
 * hairline above the price) so a list of results doesn't reflow when the real
 * data lands. Sizing the placeholder to the real thing is the whole point —
 * a skeleton that is 10px shorter than its replacement makes the page jump.
 */
export function ProviderCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-ink-200 bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex gap-4 sm:gap-5">
        <div className="skeleton h-16 w-16 shrink-0 rounded-xl sm:h-[72px] sm:w-[72px]" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton h-4 w-1/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3">
        <div className="skeleton h-4 w-1/3" />
      </div>
    </div>
  );
}
