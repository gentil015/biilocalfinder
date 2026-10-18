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
    <div className={dark ? 'w-full' : 'w-full'}>
      <form
        onSubmit={onSubmit}
        className={
          dark
            ? 'rounded-[22px] border border-white/10 bg-white/[0.06] p-2 shadow-xl backdrop-blur-2xl'
            : 'rounded-[22px] border border-ink-900/10 bg-surface p-2 shadow-lg'
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-stretch gap-2">
            <label
              className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3.5 text-ink-900 ${
                /* `dark` here means "the search sits on the always-dark hero band",
                   not the theme: the solid white field is the emphasis treatment for
                   that band and must stay white in both themes. */
                dark ? 'bg-white' : 'bg-home-mist'
              }`}
            >
              <Search className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="sr-only">{t('homeSearch.serviceLabel')}</span>
              <input
                className="bare-input text-[15px]"
                placeholder={aiMode ? t('aiSearch.placeholder') : t('homeSearch.servicePlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => setAiMode((on) => !on)}
              aria-pressed={aiMode}
              title={t('aiSearch.toggle')}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-[13px] font-bold transition ${
                aiMode
                  ? 'bg-home-gold text-home-night shadow-sm'
                  : dark
                    ? 'border border-white/15 bg-white/5 text-white/70 hover:border-home-gold/50 hover:text-white'
                    : 'border border-ink-200 bg-surface text-ink-500 hover:border-ink-300 hover:text-ink-700'
              }`}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('aiSearch.toggle')}</span>
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label
              className={
                dark
                  ? 'flex flex-1 items-center gap-3 rounded-2xl bg-white/10 px-4 py-3.5 ring-1 ring-inset ring-white/10'
                  : 'flex flex-1 items-center gap-3 rounded-2xl bg-canvas/70 px-4 py-3.5 ring-1 ring-inset ring-ink-900/10'
              }
            >
              <MapPin className="h-4 w-4 shrink-0 text-home-gold" aria-hidden="true" />
              <span className="sr-only">{t('homeSearch.locationLabel')}</span>
              <input
                className={`bare-input text-[15px] ${dark ? 'text-white placeholder:text-white/40' : 'text-ink-900 placeholder:text-ink-400'}`}
                placeholder={t('homeSearch.locationPlaceholder')}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className={`inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-home-gold px-6 text-[15px] font-bold text-home-night transition hover:bg-[#edc27e] ${
                dark ? '' : 'shadow-sm'
              }`}
            >
              {t('homeSearch.submit')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>

      {suggestions && suggestions.length > 0 && (
        <div className={`mt-4 flex flex-wrap items-center gap-2 ${dark ? '' : ''}`}>
          <span
            className={`text-2xs font-bold uppercase tracking-[0.14em] ${dark ? 'text-white/40' : 'text-ink-400'}`}
          >
            {t('homeSearch.popular')}
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go({ q: s })}
              className={
                dark
                  ? 'rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-home-gold/50 hover:bg-white/10 hover:text-white'
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