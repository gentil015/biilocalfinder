'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scale, X } from 'lucide-react';

const MAX_COMPARE = 3;

export interface CompareSelection {
  ids: string[];
  names: Record<string, string>;
  toggle: (id: string, name: string) => void;
  isSelected: (id: string) => boolean;
  isFull: boolean;
}

// Kept in page-local state (not global/localStorage) — the compare tray is
// a one-shot "I'm looking at these 3 right now" tool, not a saved list.
export function useCompareSelection(): CompareSelection {
  const [ids, setIds] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  function toggle(id: string, name: string) {
    setIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
    setNames((prev) => ({ ...prev, [id]: name }));
  }

  return { ids, names, toggle, isSelected: (id) => ids.includes(id), isFull: ids.length >= MAX_COMPARE };
}

export function CompareTray({ compare }: { compare: CompareSelection }) {
  const router = useRouter();
  if (compare.ids.length === 0) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 md:inset-x-auto md:bottom-6 md:left-1/2 md:w-auto md:max-w-lg md:-translate-x-1/2">
      <div className="animate-fade-up rounded-xl border border-ink-800 bg-home-night p-2.5 text-white shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="hidden shrink-0 items-center gap-1.5 pl-1.5 pr-1 text-xs font-bold uppercase tracking-wider text-white/50 sm:flex">
            <Scale className="h-3.5 w-3.5" aria-hidden="true" />
            Compare
          </div>

          <ul className="scroll-x flex min-w-0 flex-1 items-center gap-1.5">
            {compare.ids.map((id) => (
              <li
                key={id}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 py-1 pl-2.5 pr-1 text-xs font-semibold text-white"
              >
                <span className="max-w-[140px] truncate">{compare.names[id]}</span>
                <button
                  onClick={() => compare.toggle(id, compare.names[id])}
                  aria-label={`Remove ${compare.names[id]} from comparison`}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>

          <button
            onClick={() => router.push(`/compare?ids=${compare.ids.join(',')}`)}
            disabled={compare.ids.length < 2}
            title={compare.ids.length < 2 ? 'Select at least two providers' : undefined}
            className="btn btn-sm shrink-0 bg-home-mint text-home-night shadow-sm transition hover:bg-[#a7f3c2] disabled:opacity-40"
          >
            Compare ({compare.ids.length})
          </button>
        </div>
      </div>
    </div>
  );
}
