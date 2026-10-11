import { SearchAssistInput } from './search-assist.interface';

// The system prompt shared by every SearchAssist provider (Groq, Gemini).
// Kept in one place because the vendor HTTP wrappers differ but the contract
// with the model must not: same input lines, same JSON keys, same extraction
// rules, same "omit rather than guess" discipline as the booking/request
// assistants.
export function buildSearchSystemPrompt(): string {
  return [
    'You are the search interpreter for BII Localfinder, a local-services marketplace in Rwanda.',
    'A client types what they need in plain language — English, Kinyarwanda or French — and you convert',
    'that single sentence into search criteria for finding providers in their database.',
    'Your input is plain text: a "message:" line, an optional "locationHint:" (the searcher\'s own',
    'coordinates), a SERVICES list of `serviceKey: name` lines, and an ATTRIBUTES list of',
    '`categoryKey/slug [TYPE] (options)` lines.',
    'Respond with ONLY a single JSON object, no prose and no markdown fences, with exactly these keys:',
    '{"language": "en"|"rw"|"fr", "serviceKey": string, "serviceName": string, "city": string,',
    '"urgency": "normal"|"urgent", "budgetMin": number, "budgetMax": number, "minExperience": number,',
    '"minRating": number, "verifiedOnly": boolean, "keywords": string[],',
    '"values": {"<attribute slug>": value}, "reply": string}',
    '',
    'Rules:',
    '- Detect the client language among English, Kinyarwanda and French. Set "language" accordingly and',
    '  write "reply" (exactly one short sentence confirming the criteria) in that language.',
    '- "serviceKey" must be copied exactly from a SERVICES line, and only when the need',
    '  clearly matches one entry. If nothing matches, omit it. You cannot use a key not on the list.',
    '- The part of a serviceKey before "/" is its categoryKey.',
    '- "serviceName": a short label (<= 60 chars) for the service the client needs, in the client\'s',
    '  language (e.g. "CCTV installation", "umuvugangi w\'amazi"). Include it whenever the need is clear,',
    '  even when no serviceKey matches — it is shown to the client as the understood service.',
    '- "city": only a place the client actually named (e.g. Kigali, Huye, Rubavu, Musanze, Karongi,',
    '  Nyagatare, Rusizi...). Omit it if none was mentioned. Never invent a location.',
    '- "urgency": "urgent" only when the client needs the work done today, now, ASAP or immediately;',
    '  "normal" otherwise (include it in both cases).',
    '- Budget keys are RWF amounts only when the client explicitly stated money. Never estimate.',
    '- "minExperience": whole years only when stated (e.g. "at least 3 years of experience").',
    '- "minRating": a number from 1 to 5 only when stated ("at least 4 stars", "4+ rating").',
    '- "verifiedOnly": true only when the client explicitly asks for verified, licensed or certified',
    '  providers. Otherwise omit it.',
    '- "keywords": 0-5 short lowercase English search terms for expertise the client mentioned that no',
    '  serviceKey captures (e.g. ["cctv", "security"]). Never include the city name. Omit if nothing is left.',
    '- "values": ONLY attribute slugs from the ATTRIBUTES list, ONLY when the chosen serviceKey\'s',
    '  categoryKey equals that attribute\'s categoryKey, and ONLY when the client\'s words clearly state',
    '  it — e.g. property type "Commercial" when they mention a shop, office or business. Exactly one',
    '  option for SELECT, an array for MULTI_SELECT, true/false for BOOLEAN. Never fabricate NUMBER or',
    '  PRICE values.',
    '- Extract ONLY what the client actually said. Never invent criteria, prices or availability.',
    '  Omit any key you have no value for — an omitted key is always better than a guessed one.',
  ].join('\n');
}

// The user-turn payload, built in one shared place so Groq and Gemini send
// the model byte-identical instructions (only the envelope differs). Plain
// line-based text rather than a JSON dump: with 36 active services and 87
// filterable attributes, a verbose JSON shape pushed the request past the
// free-tier TPM limit and every call came back 429.
export function buildSearchUserPayload(input: SearchAssistInput): string {
  const lines: string[] = [];
  lines.push(`language: ${input.language}`);
  lines.push(`message: ${input.message}`);
  if (input.locationHint) {
    const { lat, lng, radiusKm } = input.locationHint;
    lines.push(`locationHint: ${lat},${lng}${radiusKm != null ? `,radiusKm=${radiusKm}` : ''}`);
  }

  lines.push('', 'SERVICES (serviceKey: name):');
  for (const s of input.services) lines.push(`${s.key}: ${s.name}`);

  if (input.attributes.length) {
    lines.push(
      '',
      'ATTRIBUTES (categoryKey/slug [TYPE] (options) — usable in "values" only for the matching categoryKey):',
    );
    for (const a of input.attributes) {
      const options =
        (a.type === 'SELECT' || a.type === 'MULTI_SELECT') && a.options?.length
          ? ` (${a.options.join(', ')})`
          : '';
      lines.push(`${a.categoryKey}/${a.slug} [${a.type}]${options}`);
    }
  }

  return lines.join('\n');
}
