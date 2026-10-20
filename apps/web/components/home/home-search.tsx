'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { interactionsApi, isLoggedIn } from '@/lib/api';
import { useI18n } from '@/components/locale-provider';

/**
 * The one search affordance both faces of the homepage share. Everything the
 * old hero form did is here: submit builds the /search query string, and a
 * logged-in search is recorded as a SEARCH interaction for personalization.
 *
 * `tone` varies the surface the field sits on — 'dark' for the marketing hero
 * (transparent field with white text), 'light' for the member hero (solid
 * white field). `suggestions` renders as quick chips that jump straight to a
 * search, so a visitor can act without typing.
 *
 * The segmented layout (service | location | actions) is the marketplace
 * standard: three clearly separated fields inside one card, so a visitor can
 * see at a glance that "what" and "where" are both accepted. On phones the
 * segments stack and the submit button spans the full width.
 */
export function HomeSearch({
  tone = 'dark',
  suggestions,
}: {
  tone?: 'dark' | 'light';
  suggestions?: string[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  // When on, submitting hands the raw sentence to the search page (ai=1),
  // which asks the AI to parse it into criteria before fetching results.
  const [aiMode, setAiMode] = useState(false);

  const dark = tone === 'dark';

  function go(search: { q?: string; loc?: string; ai?: boolean }) {
    const qs = new URLSearchParams();
    if (search.q) qs.set('q', search.q);
    if (search.loc) qs.set('location', search.loc);
    if (search.ai && search.q) qs.set('ai', '1');
    if (isLoggedIn() && search.q) {
      void interactionsApi.record({ type: 'SEARCH', metadata: { query: search.q } });
    }
    router.push(`/search?${qs.toString()}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    go({ q: query, loc: location, ai: aiMode });
  }

  return (
    <div className="w-full">
      <form
        onSubmit={onSubmit}
        aria-label={t('homeSearch.serviceLabel')}
        className={
          dark
            ? 'rounded-[22px] border border-white/15 bg-home-night/60 p-2 shadow-2xl backdrop-blur-2xl'
            : 'rounded-2xl border border-ink-200 bg-surface p-2 shadow-lift'
        }
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-stretch">
          {/* What */}
          <label
            className={`flex min-w-0 items-center gap-3 rounded-xl px-4 py-3 transition ${
              dark
                ? 'bg-white text-ink-900'
                : 'bg-canvas/60 hover:bg-canvas focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/15'
            }`}
          >
            <Search className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-2xs font-bold uppercase tracking-[0.14em] text-ink-400">
                {t('homeSearch.serviceLabel')}
              </span>
              <input
                className="bare-input mt-0.5 text-[15px] text-ink-900 placeholder:text-ink-400"
                placeholder={aiMode ? t('aiSearch.placeholder') : t('homeSearch.servicePlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>

          {/* Where */}
          <label
            className={`flex min-w-0 items-center gap-3 rounded-xl px-4 py-3 transition ${
              dark
                ? 'bg-white/10 ring-1 ring-inset ring-white/10'
                : 'bg-canvas/60 hover:bg-canvas focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/15'
            }`}
          >
            <MapPin className={`h-4 w-4 shrink-0 ${dark ? 'text-home-mint' : 'text-brand-600'}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={`block text-2xs font-bold uppercase tracking-[0.14em] ${dark ? 'text-white/40' : 'text-ink-400'}`}>
                {t('homeSearch.locationLabel')}
              </span>
              <input
                className={`bare-input mt-0.5 text-[15px] ${
                  dark ? 'text-white placeholder:text-white/40' : 'text-ink-900 placeholder:text-ink-400'
                }`}
                placeholder={t('homeSearch.locationPlaceholder')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </span>
          </label>

          {/* Actions */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 md:grid-cols-1 md:grid-rows-2">
            <button
              type="button"
              onClick={() => setAiMode((on) => !on)}
              aria-pressed={aiMode}
              aria-label={t('aiSearch.toggle')}
              title={t('aiSearch.toggle')}
              className={`inline-flex h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition md:h-full md:min-h-[52px] ${
                aiMode
                  ? dark
                    ? 'bg-home-mint text-home-night shadow-sm'
                    : 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 dark:text-home-night dark:hover:bg-brand-800'
                  : dark
                    ? 'border border-white/15 bg-white/5 text-white/70 hover:border-home-mint/50 hover:text-white'
                    : 'border border-ink-200 bg-surface text-ink-500 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800'
              }`}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('aiSearch.toggle')}</span>
            </button>
            <button
              type="submit"
              className={`inline-flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 text-[15px] font-bold transition md:h-full md:min-h-[52px] ${
                dark
                  ? 'bg-home-mint text-home-night hover:bg-[#a7f3c2]'
                  : 'bg-brand-700 text-white shadow-sm hover:bg-brand-800 active:bg-brand-900 dark:text-home-night dark:hover:bg-brand-800 dark:active:bg-brand-600'
              }`}
            >
              {t('homeSearch.submit')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`text-2xs font-bold uppercase tracking-[0.14em] ${dark ? 'text-white/40' : 'text-ink-400'}`}>
            {t('homeSearch.popular')}
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go({ q: s })}
              className={
                dark
                  ? 'rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-home-mint/50 hover:bg-white/10 hover:text-white'
                  : 'chip-interactive'
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
