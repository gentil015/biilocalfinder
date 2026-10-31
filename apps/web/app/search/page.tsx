'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  Map as MapIcon,
  Bookmark,
  LocateFixed,
  X,
  Star,
  Sparkles,
  MapPin,
  BadgeCheck,
  Zap,
  Wrench,
} from 'lucide-react';
import {
  searchApi,
  searchAssistApi,
  interactionsApi,
  isLoggedIn,
  type ProviderSearchItem,
  type ParsedSearchResult,
  type SearchChip,
} from '@/lib/api';
import { BookingPath } from '@/components/booking-path';
import { ProviderCard } from '@/components/provider-card';
import { ProviderCardSkeleton } from '@/components/provider-card-skeleton';
import { SaveSearchButton } from '@/components/save-search-button';
import { CompareTray, useCompareSelection } from '@/components/compare-tray';
import { SearchResultsMap } from '@/components/search-results-map';
import { useI18n } from '@/components/locale-provider';
import type { MessageKey } from '@/lib/locales';

const RADIUS_OPTIONS_KM = [5, 10, 25, 50];

type SortOption =
  | 'recommended'
  | 'nearest'
  | 'highest_rated'
  | 'lowest_price'
  | 'most_experienced'
  | 'available_now';

const SORTS: { value: SortOption; label: string; hint: string }[] = [
  { value: 'recommended', label: 'Recommended', hint: 'Best overall match' },
  { value: 'nearest', label: 'Nearest', hint: 'Closest to you' },
  { value: 'highest_rated', label: 'Highest rated', hint: 'Top rated first' },
  { value: 'lowest_price', label: 'Lowest price', hint: 'Cheapest first' },
  { value: 'most_experienced', label: 'Most experienced', hint: 'Most years in trade' },
  { value: 'available_now', label: 'Available now', hint: 'Free today' },
];

type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** One parsed AI criterion. Display-only: everything it shows was validated
 *  against the real catalog server-side; budgets/ratings arrive pre-formatted
 *  as language-neutral strings, attribute chips carry the database's own
 *  attribute name, and only the urgency label itself is translated here. */
function AiChip({ chip, t }: { chip: SearchChip; t: Translate }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface px-2.5 py-1 text-xs font-semibold text-brand-800';
  switch (chip.key) {
    case 'service':
      return (
        <span className={base}>
          <Wrench className="h-3 w-3 text-brand-600" aria-hidden="true" />
          {t('aiSearch.chipService')}: {chip.value}
        </span>
      );
    case 'location':
      return (
        <span className={base} aria-label={t('aiSearch.chipLocation')}>
          <MapPin className="h-3 w-3 text-brand-600" aria-hidden="true" />
          {chip.value}
        </span>
      );
    case 'urgency':
      return (
        <span className={base}>
          <Zap className="h-3 w-3 text-brand-600" aria-hidden="true" />
          {chip.value === 'urgent' ? t('aiSearch.urgencyUrgent') : t('aiSearch.urgencyNormal')}
        </span>
      );
    case 'budget':
      return (
        <span className={base}>
          {t('aiSearch.chipBudget')}: {chip.value}
        </span>
      );
    case 'experience':
      return (
        <span className={base}>
          {t('aiSearch.chipExperience')}: {chip.value}
        </span>
      );
    case 'rating':
      return (
        <span className={base} aria-label={t('aiSearch.chipRating')}>
          <Star className="h-3 w-3 fill-rating-400 text-rating-400" aria-hidden="true" />
          {chip.value}
        </span>
      );
    case 'verified':
      return (
        <span className={base}>
          <BadgeCheck className="h-3 w-3 text-brand-600" aria-hidden="true" />
          {t('aiSearch.chipVerified')}
        </span>
      );
    case 'attribute':
      return (
        <span className={base}>
          {chip.name}: {chip.value}
        </span>
      );
    default:
      return null;
  }
}

function SearchResults() {
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const compare = useCompareSelection();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [sort, setSort] = useState<SortOption>('recommended');
  const [minRating, setMinRating] = useState<number | undefined>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [availableNow, setAvailableNow] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | undefined>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // AI natural-language search. `ai=1` in the URL (set by the homepage AI
  // toggle) kicks off a parse of the sentence in `q`; while it is pending no
  // results request goes out — a sentence is not a keyword, searching with
  // it directly would just return nothing.
  //   ready      → parsed criteria are merged into every results request
  //   ready+empty→ the model read nothing usable: plain keyword fallback
  //   failed     → API/parse error: plain keyword fallback + a notice
  const [aiState, setAiState] = useState<'off' | 'pending' | 'ready' | 'failed'>('off');
  const [aiParsed, setAiParsed] = useState<ParsedSearchResult | null>(null);
  const aiParseStarted = useRef(false);

  const [items, setItems] = useState<ProviderSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const aiHasCriteria = !!aiParsed && aiParsed.chips.length > 0;

  function runAiSearch(sentence: string) {
    setAiState('pending');
    setAiParsed(null);
    searchAssistApi
      .parse({
        message: sentence,
        language: locale,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        radiusKm,
      })
      .then((res) => {
        setAiParsed(res);
        setAiState('ready');
        // Criteria will drive the search — the raw sentence leaves the
        // keyword box so the user can still narrow with their own words.
        if (res.chips.length > 0) setQuery('');
      })
      .catch(() => {
        setAiParsed(null);
        setAiState('failed');
      });
  }

  // Auto-parse once when arriving with ?ai=1 — the sentence to interpret is
  // the `q` that came along with it. The ref keeps React StrictMode's
  // double-invoked effects from burning a second (throttled) AI call.
  useEffect(() => {
    if (searchParams.get('ai') !== '1' || aiParseStarted.current) return;
    const sentence = (searchParams.get('q') ?? '').trim();
    if (!sentence) return;
    aiParseStarted.current = true;
    runAiSearch(sentence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    // Waiting on the AI parse — hold the loading state instead of firing a
    // keyword search for the full sentence.
    if (aiState === 'pending') {
      setLoading(true);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Parsed criteria apply when they exist; manual controls always win
    // over the AI's values (sort is always manual — the parser has none).
    const ai = aiState === 'ready' && aiHasCriteria ? aiParsed : null;

    searchApi
      .providers({
        // The user's own keyword (if they typed one) narrows instead of the
        // AI's tokens; with an empty box the parsed keywords are used.
        q: (query || ai?.filters.q) || undefined,
        serviceId: ai?.filters.serviceId,
        categoryId: ai?.filters.categoryId,
        sort,
        minRating: minRating ?? ai?.filters.minRating,
        verifiedOnly: verifiedOnly || ai?.filters.verifiedOnly || undefined,
        availableNow: availableNow || ai?.filters.availableNow || undefined,
        minPrice: ai?.filters.minPrice,
        maxPrice: ai?.filters.maxPrice,
        minExperience: ai?.filters.minExperience,
        // Coordinates: the searcher's own fix beats the parsed city, so the
        // map always reflects where the user actually is.
        lat: userLocation?.lat ?? ai?.filters.lat,
        lng: userLocation?.lng ?? ai?.filters.lng,
        radiusKm: userLocation ? radiusKm : ai?.filters.radiusKm,
        attributes: ai?.attributes,
        limit: 20,
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => !cancelled && setError('Unable to load providers'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [
    query,
    sort,
    minRating,
    verifiedOnly,
    availableNow,
    userLocation,
    radiusKm,
    aiState,
    aiParsed,
    aiHasCriteria,
  ]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Your browser doesn't support location");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocationError('Could not get your location');
        setLocating(false);
      },
      { timeout: 8000 },
    );
  }

  // Debounced — only records once the user pauses typing, never per
  // keystroke (spec §3: "do NOT track every tiny UI event").
  useEffect(() => {
    if (!query || !isLoggedIn()) return;
    const timeout = setTimeout(() => {
      interactionsApi.record({ type: 'SEARCH', metadata: { query } });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [query]);

  /** Number of filters narrowing the result set — drives the badge on the
   *  mobile Filters button, so a user who has filtered always knows it. */
  const activeFilterCount =
    (minRating ? 1 : 0) + (verifiedOnly ? 1 : 0) + (availableNow ? 1 : 0) + (radiusKm ? 1 : 0);

  function clearFilters() {
    setMinRating(undefined);
    setVerifiedOnly(false);
    setAvailableNow(false);
    setRadiusKm(undefined);
    setSort('recommended');
  }

  /** Drop the AI criteria. The keyword box only needs clearing when it is
   *  still holding the unparsed sentence (failed parse or no criteria read);
   *  a sentence already replaced by the user's own refinement survives. */
  function clearAi() {
    const holdsSentence = aiState === 'failed' || (aiState === 'ready' && !aiHasCriteria);
    setAiState('off');
    setAiParsed(null);
    if (holdsSentence) setQuery('');
  }

  /** Full reset — used from the empty state, where the user wants ALL of it
   *  gone: manual filters, AI criteria, and the keyword box. */
  function clearAll() {
    clearFilters();
    clearAi();
    setQuery('');
  }

  const FiltersPanel = (
    <div className="space-y-7">
      <div>
        <h3 className="eyebrow-muted mb-3">Sort by</h3>
        <div role="radiogroup" aria-label="Sort results" className="space-y-0.5">
          {SORTS.map((s) => {
            const active = sort === s.value;
            return (
              <button
                key={s.value}
                role="radio"
                aria-checked={active}
                onClick={() => setSort(s.value)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-brand-50 font-bold text-brand-800'
                    : 'font-medium text-ink-700 hover:bg-ink-50 hover:text-ink-950'
                }`}
              >
                <span>{s.label}</span>
                <span className={`text-2xs font-medium ${active ? 'text-brand-600' : 'text-ink-400'}`}>{s.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section-divider" />

      <div>
        <h3 className="eyebrow-muted mb-3">Location</h3>
        <button
          onClick={useMyLocation}
          disabled={locating}
          className={`btn btn-sm w-full ${
            userLocation
              ? 'border border-success-100 bg-success-50 text-success-700'
              : 'border border-ink-200 bg-surface text-ink-700 shadow-xs hover:bg-ink-50'
          }`}
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          {locating ? 'Locating…' : userLocation ? 'Using your location' : 'Use my location'}
        </button>
        {locationError && <p className="error-text">{locationError}</p>}
        {userLocation && (
          <div className="mt-3">
            <p className="mb-2 text-xs text-ink-500">Within</p>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  onClick={() => setRadiusKm(radiusKm === km ? undefined : km)}
                  aria-pressed={radiusKm === km}
                  className={`chip-interactive ${radiusKm === km ? 'chip-active' : ''}`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="section-divider" />

      <div>
        <h3 className="eyebrow-muted mb-3">Minimum rating</h3>
        <div className="flex flex-wrap gap-1.5">
          {[3, 4, 4.5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(minRating === r ? undefined : r)}
              aria-pressed={minRating === r}
              className={`chip-interactive ${minRating === r ? 'chip-active' : ''}`}
            >
              <Star className="h-3 w-3 fill-rating-400 text-rating-400" aria-hidden="true" />
              {r}+
            </button>
          ))}
        </div>
      </div>

      <div className="section-divider" />

      <div className="space-y-1">
        <label className="check-row">
          <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
          <span>
            Verified providers only
            <span className="block text-xs text-ink-500">Identity-checked businesses</span>
          </span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={availableNow} onChange={(e) => setAvailableNow(e.target.checked)} />
          <span>
            Available today
            <span className="block text-xs text-ink-500">Free in the next 24 hours</span>
          </span>
        </label>
      </div>

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="btn-link w-full justify-center text-xs">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );

  return (
    <main className="page-shell py-6 md:py-8">
      <div className="mb-5">
        <p className="eyebrow">Marketplace</p>
        <h1 className="page-title mt-1.5">Find a provider</h1>
        <BookingPath variant="inline" showPayNote={false} className="mt-3" />
      </div>

      {/* Search bar — the one control that has to work everywhere, so it sits
          above the fold and stays above it while scrolling. */}
      <div className="sticky top-16 z-30 -mx-5 mb-5 border-b border-ink-200 bg-canvas/90 px-5 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:mx-0 md:rounded-xl md:border md:px-2 md:shadow-xs">
        <div className="flex items-center gap-2">
          <Search className="ml-1 h-4 w-4 shrink-0 text-brand-600 md:ml-3" aria-hidden="true" />
          <input
            className="bare-input min-w-0 flex-1 px-1 py-2 text-sm"
            aria-label="Search for a service or provider"
            placeholder="Search for a service or provider…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="icon-btn h-8 w-8">
              <X className="h-4 w-4" />
            </button>
          )}
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <SaveSearchButton />
            <Link href="/saved-searches" className="btn-secondary btn-sm">
              <Bookmark className="h-4 w-4" aria-hidden="true" /> Saved
            </Link>
          </div>
          <button onClick={() => setFiltersOpen(true)} className="btn-secondary btn-sm shrink-0 md:hidden">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && <span className="count-pill">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* AI search panel — sits with the parsed criteria while they are in
          effect, and always offers a way back to a plain search. */}
      {(aiState === 'pending' || aiState === 'ready' || aiState === 'failed') && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
          {aiState === 'pending' && (
            <div className="flex items-center gap-2.5 text-sm font-semibold text-brand-800" aria-live="polite">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
              {t('aiSearch.thinking')}
            </div>
          )}

          {aiState === 'ready' && aiParsed && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink-800">
                    {aiParsed.reply}
                    {aiParsed.skippedCount > 0 &&
                      t(aiParsed.skippedCount === 1 ? 'aiSearch.skipped' : 'aiSearch.skippedPlural', {
                        count: aiParsed.skippedCount,
                      })}
                  </p>
                </div>
                <button onClick={clearAi} aria-label={t('aiSearch.clear')} className="icon-btn h-7 w-7 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {aiParsed.chips.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {aiParsed.chips.map((chip, i) => (
                    <AiChip key={`${chip.key}-${i}`} chip={chip} t={t} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 pl-6 text-xs text-ink-500">{t('aiSearch.noCriteria')}</p>
              )}

              <button onClick={clearAi} className="btn-link mt-3 text-xs">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t('aiSearch.clear')}
              </button>
            </>
          )}

          {aiState === 'failed' && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                <p className="text-sm font-medium text-ink-800">{t('aiSearch.failed')}</p>
              </div>
              <button onClick={clearAi} className="btn-link shrink-0 text-xs">
                {t('aiSearch.clear')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr_360px]">
        {/* Desktop filters (left) */}
        <aside className="hidden lg:block">
          <div className="surface-card sticky top-36 max-h-[calc(100vh-9rem)] overflow-y-auto p-5">
            {FiltersPanel}
          </div>
        </aside>

        {/* Results (center) */}
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-500" aria-live="polite">
              {loading ? (
                <span className="font-medium text-ink-700">Searching…</span>
              ) : (
                <>
                  <span className="font-bold tabular text-ink-950">{total}</span>{' '}
                  {total === 1 ? 'provider' : 'providers'} found
                </>
              )}
            </p>
            {/* Sort stays reachable from the results themselves — the left
                panel's radios share this same state, so the two never drift. */}
            <label className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
              <span className="hidden font-medium sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort results"
                className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-800 shadow-xs transition hover:border-ink-300 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!error && !loading && items.length > 0 && (
            <p className="-mt-1 mb-4 text-xs leading-relaxed text-ink-500">
              Starting prices are a guide — request a booking to get an exact quote.
            </p>
          )}

          {error && <div className="alert alert-error">{error}</div>}

          {!error && loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div className="empty-state">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-400">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 text-sm font-bold text-ink-900">No providers match these filters</p>
              <p className="mt-1.5 max-w-xs text-sm text-ink-500">
                Try a broader search term, or clear a filter or two to widen the results.
              </p>
              {(activeFilterCount > 0 || query || aiState !== 'off') && (
                <button onClick={clearAll} className="btn-secondary btn-sm mt-5">
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!error && !loading && items.length > 0 && (
            <div className="space-y-3">
              {items.map((p) => (
                <ProviderCard key={p.id} provider={p} compare={compare} />
              ))}
            </div>
          )}
        </section>

        {/* Desktop map (right) */}
        <aside className="hidden lg:block">
          <div className="sticky top-36 h-[520px] overflow-hidden rounded-xl border border-ink-200 shadow-xs">
            <SearchResultsMap providers={items} userLocation={userLocation} height={520} />
          </div>
        </aside>
      </div>

      {/* Mobile map button — sits above the mobile tab bar. */}
      <button
        onClick={() => setMapOpen(true)}
        className="btn btn-md fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 border border-ink-200 bg-surface text-ink-900 shadow-xl hover:bg-ink-50 lg:hidden"
      >
        <MapIcon className="h-4 w-4" aria-hidden="true" /> Map
      </button>

      {/* Mobile filters bottom sheet */}
      {filtersOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-home-night/40 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="animate-slide-up-sheet max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink-200" />
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-950">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="icon-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FiltersPanel}
            <button onClick={() => setFiltersOpen(false)} className="btn-primary mt-6 w-full">
              Show {loading ? '…' : `${total} result${total === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {/* Mobile map bottom sheet */}
      {mapOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-home-night/40 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Map"
          onClick={() => setMapOpen(false)}
        >
          <div
            className="animate-slide-up-sheet h-[80vh] w-full overflow-hidden rounded-t-2xl bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-200" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink-950">Map</h2>
              <button onClick={() => setMapOpen(false)} aria-label="Close map" className="icon-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3rem)] overflow-hidden rounded-xl border border-ink-200">
              <SearchResultsMap providers={items} userLocation={userLocation} height="100%" />
            </div>
          </div>
        </div>
      )}
      <CompareTray compare={compare} />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
