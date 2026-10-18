'use client';

import { Check, LucideIcon } from 'lucide-react';

export function ProviderTypeCard({
  icon: Icon,
  title,
  description,
  examples,
  selected,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition duration-200 ease-out sm:p-5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 ${
        selected
          ? 'border-ink-950 bg-home-night text-white shadow-sm'
          : 'border-ink-200 bg-surface shadow-xs hover:border-ink-300 hover:shadow-md'
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${
          selected ? 'bg-accent-400 text-home-night' : 'bg-ink-100 text-ink-500'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className={`text-[15px] font-bold tracking-tight ${selected ? 'text-white' : 'text-ink-950'}`}>
            {title}
          </span>
          <span
            aria-hidden="true"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              selected ? 'border-accent-400 bg-accent-400' : 'border-ink-300 bg-surface'
            }`}
          >
            {selected && <Check className="h-3.5 w-3.5 text-home-night" strokeWidth={3} />}
          </span>
        </span>

        <span className={`mt-1 block text-sm leading-relaxed ${selected ? 'text-white/65' : 'text-ink-600'}`}>
          {description}
        </span>
        <span className={`mt-2 block text-xs ${selected ? 'text-white/40' : 'text-ink-400'}`}>e.g. {examples}</span>
      </span>
    </button>
  );
}
