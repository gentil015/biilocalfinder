// The languages the search interpreter understands — the same superset as
// the booking assistant: the UI ships en/rw, but a client may type French.
export const SEARCH_ASSIST_LANGUAGES = ['en', 'rw', 'fr'] as const;

export type SearchAssistLanguage = (typeof SEARCH_ASSIST_LANGUAGES)[number];

export const DEFAULT_SEARCH_ASSIST_LANGUAGE: SearchAssistLanguage = 'en';

export function isSearchAssistLanguage(value: unknown): value is SearchAssistLanguage {
  return typeof value === 'string' && (SEARCH_ASSIST_LANGUAGES as readonly string[]).includes(value);
}

// One entry of the active service catalog, as handed to the model. The key
// is `${categorySlug}/${serviceSlug}` — the same reversible, non-UUID handle
// booking-assist uses, so the model picks from a fixed list without ever
// reasoning about internal database ids. The categoryKey needed to scope
// attribute matching is the prefix of that key, so it is never repeated
// here: the catalog is sent as `key: name` lines (see buildSearchUserPayload)
// purely to keep the token count well under free-tier TPM limits.
export interface SearchCatalogEntry {
  key: string;
  name: string;
}

// A filterable category attribute the model may use as a search criterion.
// `categoryKey` scopes it: a "propertyType = Commercial" filter is only
// legal for a service in that same category, and SearchAssistService
// re-checks exactly that before the value ever reaches the search query.
export interface SearchAssistAttribute {
  categoryKey: string;
  slug: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'PRICE';
  options?: string[] | null;
}

export interface SearchAssistInput {
  // Preferred language — the reply and any free-text labels come back in
  // this language; detection may override it with the client's own.
  language: SearchAssistLanguage;
  // The natural-language request, already size-capped by the controller.
  message: string;
  // The only services the model may select — real, active catalog rows.
  services: SearchCatalogEntry[];
  // Filterable public attributes across all categories, one pass, because
  // the model chooses the service and its criteria in the same turn.
  attributes: SearchAssistAttribute[];
  // The searcher's own coordinates when the browser shared them — used only
  // as a "near me" fallback, never to override a city the client named.
  locationHint?: { lat: number; lng: number; radiusKm?: number };
}

// Raw, UNTRUSTED model output. SearchAssistService is the only place this
// shape is ever read: every field is re-validated (service key resolved
// against the real catalog, city resolved against a known-places table,
// budgets/years/ratings range-checked, attribute values re-run through
// CategoriesService.validateAttributeValue) before any of it becomes search
// criteria. Never persist or return directly.
export interface SearchAssistOutput {
  language?: string;
  serviceKey?: string;
  serviceName?: string;
  city?: string;
  urgency?: string; // 'normal' | 'urgent'
  budgetMin?: number;
  budgetMax?: number;
  minExperience?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  keywords?: string[];
  values?: Record<string, unknown>; // keyed by attribute slug
  reply?: string;
}

// Business logic never talks to Groq/Gemini directly — only through this
// interface, matching the BookingAssistProvider/RequestAssistProvider
// pattern, so the vendor can be swapped via SEARCH_ASSIST_PROVIDER without
// touching the controller/service.
export interface SearchAssistProvider {
  parse(input: SearchAssistInput): Promise<SearchAssistOutput>;
}

export const SEARCH_ASSIST_PROVIDER = 'SEARCH_ASSIST_PROVIDER';

// Bounds the prompt, the paid external call, and the abuse surface — one
// search is a single short sentence, nothing more.
export const MAX_SEARCH_ASSIST_TEXT_LENGTH = 500;
