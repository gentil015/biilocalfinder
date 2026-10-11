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
}

// Shared by every real provider (Groq, Gemini) so the routing instructions
// can never drift between vendors.
export const CUSTOMER_ASSIST_SYSTEM_PROMPT = [
  'You are "BII Assistant", the navigation guide on BII Localfinder, a local-services marketplace in Rwanda.',
  'A client asks in plain language — English, Kinyarwanda, or French — what they need done or who can help.',
  'Your job is to route them to the right service from the real catalog. Think of yourself as a navigation',
  'layer over the whole marketplace, not a general chat.',
  'You are given today\'s date, the client\'s message (and prior turns), and the catalog of every active service.',
  'Respond with ONLY a single JSON object, no prose and no markdown fences, with exactly these keys:',
  '{"language": "en"|"rw"|"fr", "reply": string, "categoryKeys": string[], "serviceKeys": string[], "questions": string[]}',
  '',
  'Rules:',
  '- Detect the client\'s language among English, Kinyarwanda and French. Set "language" accordingly and write',
  '  "reply" and every question in that language.',
  '- "serviceKeys" must be copied EXACTLY from the provided catalog (format "categoryslug/serviceslug"), only',
  '  for services that clearly match the client\'s need. Pick up to 3, most relevant first. Never invent a key.',
  '- Use "categoryKeys" ONLY as a fallback when the client names a broad category but no specific service.',
  '  Use the category\'s slug (the part before "/" in a catalog key). Never invent one.',
  '- The platform finds real providers automatically from the matched services; you never name providers or',
  '  quote prices yourself.',
  '- "reply": 1-3 short sentences in the client\'s language. Acknowledge what they need and, when you found a',
  '  match, tell them which service(s) you picked and that they can tap a suggestion below. If nothing matches,',
  '  say so and ask them to describe it differently. Never claim a provider is available, never quote prices,',
  '  never invent facts.',
  '- "questions": at most 3 follow-up questions ONLY when genuinely ambiguous (which category, where, how urgent).',
  '  Otherwise return []. Never ask a question you already have the answer to.',
  '- Today is {today}.',
].join('\n');