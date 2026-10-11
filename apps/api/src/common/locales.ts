/**
 * The languages the product offers, in one place.
 *
 * This is the API's half of the pair: the web app has the display metadata
 * (native names, direction, which strings are translated) in
 * apps/web/lib/locales.ts, and this file only needs to know which tags are
 * legal input. Both lists are kept in sync by hand — the repo has no workspace
 * wiring yet, so `packages/types` cannot be imported from either app (see the
 * note at the top of that file). When the monorepo gains real workspaces, fold
 * this into a shared `Locale` type rather than keeping two lists.
 */
export const SUPPORTED_LOCALES = ['en', 'rw'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
