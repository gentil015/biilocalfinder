// The languages the booking assistant understands. A superset of
// SUPPORTED_LOCALES (common/locales.ts): the product UI itself only ships
// en/rw today, but a client may describe a job in French — the assistant
// must extract it and answer back in the same language.
export const BOOKING_ASSIST_LANGUAGES = ['en', 'rw', 'fr'] as const;

export type BookingAssistLanguage = (typeof BOOKING_ASSIST_LANGUAGES)[number];

export const DEFAULT_BOOKING_ASSIST_LANGUAGE: BookingAssistLanguage = 'en';

export function isBookingAssistLanguage(value: unknown): value is BookingAssistLanguage {
  return typeof value === 'string' && (BOOKING_ASSIST_LANGUAGES as readonly string[]).includes(value);
}

export type BookingAssistAttributeType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT' | 'PRICE';

// One entry of the active service catalog, as handed to the model. The key
// is `${categorySlug}/${serviceSlug}` — a reversible, non-UUID handle so
// the model can pick from a fixed list without ever reasoning about
// internal database ids (same convention as AssistAttributeSchema slugs).
export interface BookingCatalogEntry {
  key: string;
  name: string;
  category: string;
}

// The subset of a CategoryAttribute the assistant may ask about or fill.
export interface BookingAssistAttribute {
  slug: string;
  name: string;
  description?: string | null;
  type: BookingAssistAttributeType;
  isRequired: boolean;
  options?: string[] | null;
}

export interface BookingAssistMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface BookingAssistInput {
  // Preferred language — always answered in the client's own language when
  // detectable; this is the fallback when detection is ambiguous.
  language: BookingAssistLanguage;
  // Conversation so far (oldest first), already length-capped by the
  // caller, with the latest client message as the final 'user' entry.
  messages: BookingAssistMessage[];
  // The only services the model is allowed to suggest — real, active
  // catalog rows loaded by BookingAssistService.
  services: BookingCatalogEntry[];
  // When the form is already pinned to a service (deep-link to an
  // offering, or a service picked earlier in the conversation), the model
  // must not suggest a different one.
  serviceLocked?: BookingCatalogEntry;
  // Public category attributes of the locked service's category (empty
  // until a service is known — the category determines which questions
  // even exist).
  attributes: BookingAssistAttribute[];
}

// Raw, UNTRUSTED model output. BookingAssistService is the only place this
// shape is ever read: every field is re-validated (service key resolved
// against the real catalog, dates/times/budgets format-checked, attribute
// values re-run through CategoriesService.validateAttributeValue, sizes
// capped) before it reaches a client. Never persist or return directly.
export interface BookingAssistOutput {
  language?: string;
  serviceKey?: string;
  title?: string;
  description?: string;
  preferredDate?: string; // YYYY-MM-DD
  preferredTime?: string; // HH:MM
  budgetMin?: number;
  budgetMax?: number;
  additionalNotes?: string;
  values?: Record<string, unknown>; // keyed by attribute slug
  questions?: string[];
  reply?: string;
}

// Business logic never talks to Gemini (or any AI vendor) directly — only
// through this interface, matching MapProvider/PaymentProvider and the
// RequestAssistProvider pattern, so the vendor can be swapped via
// BOOKING_ASSIST_PROVIDER without touching the controller/service.
export interface BookingAssistProvider {
  suggest(input: BookingAssistInput): Promise<BookingAssistOutput>;
}

export const BOOKING_ASSIST_PROVIDER = 'BOOKING_ASSIST_PROVIDER';

// Bounds the prompt, the paid external call, and the abuse surface — a
// client never gets to dictate a larger size than this.
export const MAX_BOOKING_ASSIST_TEXT_LENGTH = 1500;
// Conversation context sent with each turn: enough for a short back-and-
// forth, small enough to keep every call cheap.
export const MAX_BOOKING_ASSIST_HISTORY = 10;
export const MAX_BOOKING_ASSIST_QUESTIONS = 6;
