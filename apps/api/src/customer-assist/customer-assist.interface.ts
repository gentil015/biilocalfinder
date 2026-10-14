// The assistant understands the same three languages as the booking
// assistant: the product UI ships en/rw today, but a client may ask in
// French and must get an answer in the same language.
export const CUSTOMER_ASSIST_LANGUAGES = ['en', 'rw', 'fr'] as const;

export type CustomerAssistLanguage = (typeof CUSTOMER_ASSIST_LANGUAGES)[number];

export const DEFAULT_CUSTOMER_ASSIST_LANGUAGE: CustomerAssistLanguage = 'en';

export function isCustomerAssistLanguage(value: unknown): value is CustomerAssistLanguage {
  return typeof value === 'string' && (CUSTOMER_ASSIST_LANGUAGES as readonly string[]).includes(value);
}

// Bounds the prompt, the paid external call, and the abuse surface — a
// client never gets to dictate a larger size than this.
export const MAX_CUSTOMER_ASSIST_TEXT_LENGTH = 600;
export const MAX_CUSTOMER_ASSIST_HISTORY = 10;
export const MAX_CUSTOMER_ASSIST_QUESTIONS = 3;
export const MAX_CUSTOMER_ASSIST_SERVICES = 6;
export const MAX_CUSTOMER_ASSIST_CATEGORIES = 4;
export const MAX_CUSTOMER_ASSIST_PROVIDERS = 5;
export const MAX_CUSTOMER_ASSIST_ACTIONS = 4;
export const MAX_CUSTOMER_ASSIST_SEARCH_QUERY = 160;

// One entry of the live catalog as handed to the model. The key is
// `${categorySlug}/${serviceSlug}` — a reversible, non-UUID handle so the
// model can pick from a fixed list without ever reasoning about internal
// database ids. The model never sees `serviceId`.
export interface CustomerAssistCatalogEntry {
  key: string;
  serviceId: string;
  name: string;
  category: string;
}

export interface CustomerAssistMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface CustomerAssistInput {
  language: CustomerAssistLanguage;
  // Conversation so far (oldest first), already length-capped, ending with
  // the latest client message.
  messages: CustomerAssistMessage[];
  // The only services the assistant is allowed to suggest — real, active
  // catalog rows loaded by CustomerAssistService.
  services: { key: string; name: string; category: string }[];
}

// Raw, UNTRUSTED model output. CustomerAssistService is the only place this
// shape is ever read: every key is re-resolved against real catalog rows and
// the reply/question fields are size-capped before reaching a client. The
// model routes (picks service/category keys); it never names providers or
// prices — the service resolves real providers from the database so the
// assistant can never hallucinate one.
export interface CustomerAssistOutput {
  language?: string;
  reply?: string;
  // Fallback used when the client names a broad category but no service.
  categoryKeys?: string[];
  serviceKeys?: string[];
  questions?: string[];
  // A short natural-language sentence the client can be sent to the search
  // page with (the page re-interprets it into filters). Omitted for plain
  // platform questions.
  searchQuery?: string;
  // Page shortcuts the assistant thinks are useful next, drawn from a fixed
  // vocabulary (see CUSTOMER_ASSIST_LINK_KINDS). The service maps each to a
  // real route — the model never supplies a URL.
  links?: string[];
}

// The only page shortcuts the assistant may point to. The model picks from
// this fixed list; CustomerAssistService owns the actual href and the
// localized label, so a forged or hallucinated destination is impossible.
export const CUSTOMER_ASSIST_LINK_KINDS = [
  'become-provider',
  'bookings',
  'messages',
  'saved-searches',
  'disputes',
  'account',
] as const;

export type CustomerAssistLinkKind = (typeof CUSTOMER_ASSIST_LINK_KINDS)[number];

// A ready-to-render action button in the assistant reply. `href` is always
// built server-side from a validated kind (or a sanitized search sentence),
// never taken from model output.
export interface CustomerAssistAction {
  kind: 'search' | CustomerAssistLinkKind;
  label: string;
  href: string;
}

export interface CustomerAssistProvider {
  suggest(input: CustomerAssistInput): Promise<CustomerAssistOutput>;
}

export const CUSTOMER_ASSIST_PROVIDER = 'CUSTOMER_ASSIST_PROVIDER';

// Real providers resolved for the matched service(s). Also what the
// frontend's provider cards render — a deep link to /providers/:id.
export interface CustomerAssistProviderRow {
  id: string;
  businessName: string;
  city: string | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  avatarUrl: string | null;
}

// Suggested service chip: tapping it deep-links to a pre-filled
// request form for that service.
export interface CustomerAssistServiceSuggestion {
  id: string;
  key: string;
  name: string;
  category: string;
  providerCount: number;
}

export interface CustomerAssistResult {
  reply: string;
  language: CustomerAssistLanguage;
  questions: string[];
  suggestions: {
    services: CustomerAssistServiceSuggestion[];
    providers: CustomerAssistProviderRow[];
  };
  actions: CustomerAssistAction[];
}

// Shared by every real provider (Groq, Gemini) so the routing instructions
// can never drift between vendors.
export const CUSTOMER_ASSIST_SYSTEM_PROMPT = [
  'You are "BII Assistant", the guide for BII Localfinder, a local-services marketplace in Rwanda.',
  'A client asks in plain language — English, Kinyarwanda, or French — what they need done, who can help, or',
  'how the platform works. Think of yourself as the navigation and help layer over the whole marketplace.',
  'You are given today\'s date, the client\'s message (and prior turns), and the catalog of every active service.',
  'Respond with ONLY a single JSON object, no prose and no markdown fences, with exactly these keys:',
  '{"language": "en"|"rw"|"fr", "reply": string, "categoryKeys": string[], "serviceKeys": string[],',
  '"questions": string[], "searchQuery": string, "links": string[]}',
  '',
  'How the marketplace works — facts you may state:',
  '- BII Localfinder connects clients with local service providers in Rwanda. It is the marketplace, not the',
  '  provider: work is done by the providers who list on it.',
  '- The normal flow: the client searches or posts a request; interested providers send quotes; the client',
  '  compares those quotes and books the one they choose; a review can be left after the work is completed.',
  '- BII Localfinder NEVER handles the payment between a client and a provider. The client and provider agree',
  '  on a price and pay each other directly (cash, mobile money, or bank). The platform only charges providers',
  '  a subscription to list. Never say the platform holds, escrows, guarantees or refunds a payment.',
  '- Providers may be verified (identity and business checked). Clients can filter a search to verified',
  '  providers only, and to providers available today.',
  '- Search, requests, quotes, in-app messages, bookings and disputes all happen on the platform.',
  '- Someone who wants to offer services registers as a provider (via "Become a provider") and picks a',
  '  subscription plan.',
  '',
  'Rules:',
  '- Detect the client\'s language among English, Kinyarwanda and French. Set "language" accordingly and write',
  '  "reply", every question and "searchQuery" in that language.',
  '- "serviceKeys" must be copied EXACTLY from the provided catalog (format "categoryslug/serviceslug"), only',
  '  for services that clearly match the client\'s need. Pick up to 3, most relevant first. Never invent a key.',
  '- Use "categoryKeys" ONLY as a fallback when the client names a broad category but no specific service.',
  '  Use the category\'s slug (the part before "/" in a catalog key). Never invent one.',
  '- The platform finds real providers automatically from the matched services; you never name providers or',
  '  quote prices yourself.',
  '- "reply": 1-3 short sentences in the client\'s language. Acknowledge what they need and, when you found a',
  '  match, tell them which service(s) you picked and that they can tap a suggestion below. When the client',
  '  asks how the platform works, answer them directly and truthfully using the facts above. If nothing',
  '  matches, say so and ask them to describe it differently. Never claim a provider is available, never quote',
  '  prices, never invent facts.',
  '- "questions": at most 3 follow-up questions ONLY when genuinely ambiguous (which category, where, how',
  '  urgent). Otherwise return []. Never ask a question you already have the answer to.',
  '- "searchQuery": when the client describes what and where they need something in concrete terms, give one',
  '  short natural-language search sentence (<= 120 chars) they could be taken to the search page with, e.g.',
  '  "plumber in Kigali available today" or "umufundi w\'amazi i Kigali". Omit it for general platform or',
  '  account questions.',
  '- "links": 0 to 2 page shortcuts, ONLY from this exact list, and ONLY when clearly relevant:',
  '  "become-provider" (to sell services), "bookings" (their bookings), "messages" (their chats),',
  '  "saved-searches" (saved searches), "disputes" (a problem with a booking), "account" (profile/settings).',
  '  Never output any other value. Omit when none applies.',
  '- Today is {today}.',
].join('\n');