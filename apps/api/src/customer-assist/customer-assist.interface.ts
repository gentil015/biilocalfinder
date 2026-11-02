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

// Who the assistant is talking to. GUEST still gets the full public guide;
// signed-in users additionally get their own live marketplace context.
export type CustomerAssistRole = 'GUEST' | 'CLIENT' | 'PROVIDER' | 'ADMIN';

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

// The statuses in which a request still accepts a new quote. Mirrors
// ServiceRequestsService's private ACCEPTING_STATUSES so the assistant can
// only offer "send a quote" on a request where quoting is actually legal.
export const CUSTOMER_ASSIST_ACCEPTING_REQUEST_STATUSES = ['OPEN', 'QUOTED', 'NEGOTIATING'] as const;

// --- Live, per-user context -------------------------------------------------
// Only real rows belonging to the signed-in user are ever placed here. Refs
// ("cr1", "pb2", …) are the only handles the model sees; the service maps
// them back to database ids after validating ownership. No emails, phone
// numbers, addresses, or other direct identifiers are included.

export interface CustomerAssistClientRequest {
  ref: string;
  title: string;
  status: string;
  service: string;
  quoteCount: number;
  createdAt: string;
}

export interface CustomerAssistClientBooking {
  ref: string;
  service: string;
  provider: string;
  status: string;
  scheduledAt: string | null;
}

export interface CustomerAssistClientQuote {
  ref: string;
  request: string;
  provider: string;
  price: number;
  status: string;
  createdAt: string;
}

export interface CustomerAssistClientContext {
  requests: CustomerAssistClientRequest[];
  bookings: CustomerAssistClientBooking[];
  quotes: CustomerAssistClientQuote[];
}

export interface CustomerAssistProviderIncomingRequest {
  ref: string;
  title: string;
  service: string;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  preferredDate: string | null;
  quoteCount: number;
  canQuote: boolean;
}

export interface CustomerAssistProviderBooking {
  ref: string;
  requestId: string;
  service: string;
  status: string;
  scheduledAt: string | null;
}

export interface CustomerAssistProviderQuote {
  ref: string;
  request: string;
  price: number;
  status: string;
  createdAt: string;
}

export interface CustomerAssistProviderOffering {
  ref: string;
  service: string;
  title: string;
  price: number | null;
  isActive: boolean;
}

export interface CustomerAssistProviderContext {
  businessName: string;
  verificationStatus: string;
  availabilityStatus: string;
  rating: number;
  reviewCount: number;
  city: string | null;
  hasDescription: boolean;
  hasLogo: boolean;
  onboardingComplete: boolean;
  // True when the user belongs to more than one provider workspace and no
  // x-workspace-id narrowed it down. Read-only context is still useful, but
  // write actions (quote/availability) are withheld because the target
  // workspace would be ambiguous.
  multipleWorkspaces: boolean;
  offerings: CustomerAssistProviderOffering[];
  incomingRequests: CustomerAssistProviderIncomingRequest[];
  bookings: CustomerAssistProviderBooking[];
  quotes: CustomerAssistProviderQuote[];
  availability: {
    status: string;
    days: { dayOfWeek: number; startTime: string; endTime: string }[];
    exceptions: { date: string; isAvailable: boolean }[];
  };
}

export interface CustomerAssistContext {
  client?: CustomerAssistClientContext;
  provider?: CustomerAssistProviderContext;
}

export interface CustomerAssistMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface CustomerAssistInput {
  language: CustomerAssistLanguage;
  role: CustomerAssistRole;
  // Conversation so far (oldest first), already length-capped, ending with
  // the latest client message.
  messages: CustomerAssistMessage[];
  // The only services the assistant is allowed to suggest — real, active
  // catalog rows loaded by CustomerAssistService.
  services: { key: string; name: string; category: string }[];
  // The signed-in user's own live marketplace data. Absent for guests.
  context?: CustomerAssistContext;
}

// A rich action the model wants to offer. This is an INTENT, never executed
// directly: CustomerAssistService re-validates the kind, every ref against
// the caller's own live context, and every value (price, date, status,
// lengths) before returning a CustomerAssistAction. Anything invalid is
// dropped. Write actions are only ever proposed; the UI asks the user to
// confirm before calling the real endpoint.
export interface CustomerAssistActionIntent {
  kind?: string;
  serviceKey?: string;
  title?: string;
  description?: string;
  preferredDate?: string;
  preferredTime?: string;
  budgetMin?: number;
  budgetMax?: number;
  additionalNotes?: string;
  requestRef?: string;
  bookingRef?: string;
  offeringRef?: string;
  price?: number;
  estimatedDuration?: string;
  status?: string;
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
  // Rich actions (open a specific record, prefill a request, send a quote,
  // toggle availability). Re-validated against the caller's live context.
  actions?: CustomerAssistActionIntent[];
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

export const CUSTOMER_ASSIST_RICH_ACTION_KINDS = [
  'prefill-request',
  'open-booking',
  'open-request',
  'open-offering',
  'send-quote',
  'toggle-availability',
] as const;

export type CustomerAssistRichActionKind = (typeof CUSTOMER_ASSIST_RICH_ACTION_KINDS)[number];

// A ready-to-render action button in the assistant reply. Every field is
// built server-side from validated data (or a sanitized search sentence),
// never taken raw from model output. Navigation actions carry `href`; write
// actions carry a validated `payload` and `requiresConfirmation: true`.
export interface CustomerAssistAction {
  kind: 'search' | CustomerAssistLinkKind | CustomerAssistRichActionKind;
  label: string;
  href?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
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
  role: CustomerAssistRole;
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
  'You are "BII Assistant", the guide and task helper for BII Localfinder, a local-services marketplace in Rwanda.',
  'You talk to one person at a time. Their role is given as GUEST, CLIENT, PROVIDER or ADMIN. Guests only get the',
  'public guide. Signed-in users also get a JSON snapshot of their own live data (requests, quotes, bookings,',
  'offerings, availability, profile status). Treat that snapshot as the only truth about their account.',
  'Respond with ONLY a single JSON object, no prose and no markdown fences:',
  '{"language":"en"|"rw"|"fr","reply":string,"categoryKeys":string[],"serviceKeys":string[],"questions":string[],',
  '"searchQuery":string,"links":string[],"actions":array}',
  '',
  'How the marketplace works — facts you may state:',
  '- BII Localfinder connects clients with local service providers in Rwanda. It is the marketplace, not the provider.',
  '- Client flow: search or post a request; interested providers send quotes; the client compares quotes and books one;',
  '  after the work is completed the client can leave a review. Disputes are opened from a booking if something goes wrong.',
  '- Provider flow: register as a provider, complete onboarding and verification, publish service offerings with prices,',
  '  set availability, then send quotes on incoming client requests. A quote can be accepted, declined, withdrawn or',
  '  expire. Providers manage bookings and see performance on their dashboard and analytics pages.',
  '- BII Localfinder NEVER handles the payment between a client and a provider. Client and provider agree on a price and',
  '  pay each other directly (cash, mobile money, or bank). The platform only charges providers a subscription to list.',
  '  Never say the platform holds, escrows, guarantees or refunds a payment.',
  '- Providers may be verified (identity and business checked). Clients can filter to verified providers and to providers',
  '  available today. Verification is requested from the provider verification page.',
  '- Search, requests, quotes, in-app messages, bookings and disputes all happen on the platform.',
  '',
  'Rules:',
  '- Detect the language among English, Kinyarwanda and French. Set "language" and write "reply", every question,',
  '  "searchQuery" and every action label/summary in that language.',
  '- "serviceKeys" must be copied EXACTLY from the provided catalog ("categoryslug/serviceslug"), only for services',
  '  that clearly match. Pick up to 3, most relevant first. Never invent a key. Use "categoryKeys" (slug only) only as',
  '  a fallback for a broad category.',
  '- The platform finds real providers from matched services; never name providers or invent prices.',
  '- "reply": 1-4 short sentences. Acknowledge the need, answer platform/account questions truthfully from the facts and',
  '  the snapshot, and mention the actions you are offering. Never claim availability, prices, payments or statuses that',
  '  are not in the snapshot. If the snapshot does not cover the question, say you cannot see it and point them to the',
  '  right page.',
  '- "questions": at most 3 follow-up questions ONLY when genuinely ambiguous. Otherwise [].',
  '- "searchQuery": one short natural-language sentence (<=120 chars) for concrete client needs, else omit.',
  '- "links": 0-2 shortcuts from this exact list, only when relevant: "become-provider", "bookings", "messages",',
  '  "saved-searches", "disputes", "account". Never output any other value.',
  '',
  'Actions — only when they genuinely help the current user:',
  '- "prefill-request": a client wants to post a request. Give a catalog "serviceKey" plus title, description,',
  '  preferredDate (YYYY-MM-DD), preferredTime (HH:MM), budgetMin, budgetMax, additionalNotes when known.',
  '- "open-request": open one of the caller\'s own requests, using its "ref" from context.',
  '- "open-booking": open one of the caller\'s own bookings, using its "ref" from context.',
  '- "open-offering": open a provider offering, using the offering "ref" from context.',
  '- "send-quote": a provider quoting an incoming request. Use the request "ref" and a numeric "price"; optional',
  '  "estimatedDuration" and "description". Only when that request has canQuote=true. This is a WRITE, proposed and',
  '  sent only after the user confirms.',
  '- "toggle-availability": a provider switching status, with "status" = "AVAILABLE" or "UNAVAILABLE". This is a',
  '  WRITE and needs confirmation.',
  'Refs are prefixed by type: cr=client request, cb=client booking, pr=provider incoming request, pb=provider',
  'booking, o=offering. Each action is {"kind":string, ...fields}. Use refs EXACTLY as given in context; never',
  'invent a ref. Omit actions the role or context does not allow. Never put URLs in actions.',
  '- Today is {today}.',
].join('\n');