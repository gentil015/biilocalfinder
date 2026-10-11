export type AssistAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'PRICE';

// The subset of a CategoryAttribute an assist provider needs to know about.
// Keyed by slug, never id, when talking to the provider — providers (an
// LLM prompt, a future different vendor) should never need to reason about
// internal database ids.
export interface AssistAttributeSchema {
  slug: string;
  name: string;
  description?: string | null;
  type: AssistAttributeType;
  isRequired: boolean;
  options?: string[] | null;
}

export interface RequestAssistInput {
  categoryName: string;
  serviceName: string;
  attributes: AssistAttributeSchema[];
  clientText?: string;
  // Pre-fetched and size-checked by the caller — providers never fetch a
  // URL themselves (spec pattern: never trust/re-fetch client-supplied
  // locations from inside a provider).
  imageBase64?: string;
  imageMimeType?: string;
}

// Raw, UNTRUSTED provider output. RequestAssistService is the only place
// this is ever read — every field is re-validated (title/description
// length-capped, every attribute value re-run through
// CategoriesService.validateAttributeValue) before it reaches a client or
// the database. Never persist or return this shape directly.
export interface RequestAssistSuggestion {
  title?: string;
  description?: string;
  values: Record<string, unknown>; // keyed by attribute slug
}

// Business logic never talks to Anthropic (or any AI vendor) directly —
// only through this interface, matching MapProvider/PaymentProvider, so the
// vendor can be swapped via REQUEST_ASSIST_PROVIDER without touching the
// controller/service.
export interface RequestAssistProvider {
  suggest(input: RequestAssistInput): Promise<RequestAssistSuggestion>;
}

export const REQUEST_ASSIST_PROVIDER = 'REQUEST_ASSIST_PROVIDER';
export const MAX_ASSIST_TEXT_LENGTH = 1500;
export const MAX_ASSIST_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — vision calls get expensive fast
