import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  BookingAssistInput,
  BookingAssistOutput,
  BookingAssistProvider,
} from '../booking-assist.interface';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to the Gemini generateContent API directly over fetch (Node 20 has
// it built in) rather than pulling in an SDK dependency for one call site —
// same approach as AnthropicAssistProvider. The API key lives only in the
// backend environment (GEMINI_API_KEY); it is sent as a header so it never
// appears in a URL that could be logged. Never called with anything other
// than pre-validated, size-capped input — see BookingAssistService. Its
// output is UNTRUSTED and re-validated by the caller; this class only
// parses JSON out of the model's text response.
@Injectable()
export class GeminiBookingAssistProvider implements BookingAssistProvider {
  private readonly logger = new Logger(GeminiBookingAssistProvider.name);
  private readonly apiKey = process.env.GEMINI_API_KEY!;
  private readonly model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  async suggest(input: BookingAssistInput): Promise<BookingAssistOutput> {
    const system = this.buildSystemPrompt();
    const payload = JSON.stringify({
      language: input.language,
      today: new Date().toISOString().slice(0, 10),
      serviceLocked: input.serviceLocked ?? null,
      services: input.services,
      fields: input.attributes.map((a) => ({
        slug: a.slug,
        name: a.name,
        description: a.description ?? undefined,
        type: a.type,
        required: a.isRequired,
        options: a.options ?? undefined,
      })),
      message: input.messages[input.messages.length - 1]?.text ?? '',
    });

    // Gemini alternates user/model turns; our history already ends with the
    // latest client message, and any 'model' role is mapped to 'model'.
    const contents = input.messages
      .slice(0, -1)
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: payload }] });

    let res: Response;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        res = await fetch(`${GEMINI_API_URL}/${this.model}:generateContent`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1024,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });
      } catch (err) {
        lastStatus = 0;
        if (attempt === MAX_ATTEMPTS) {
          this.logger.warn(`Gemini booking-assist call failed: ${(err as Error).message}`);
          throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
        }
        await this.delay(RETRY_DELAY_MS);
        continue;
      } finally {
        clearTimeout(timeout);
      }

      lastStatus = res.status;
      if (res.ok) break;

      if ((res.status === 429 || res.status === 503) && attempt < MAX_ATTEMPTS) {
        this.logger.warn(`Gemini booking-assist transient ${res.status}, retrying (${attempt}/${MAX_ATTEMPTS})`);
        await this.delay(RETRY_DELAY_MS);
        continue;
      }

      this.logger.warn(`Gemini booking-assist call returned ${lastStatus}`);
      throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
    }

    const body = await res!.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (!text) {
      this.logger.warn('Gemini booking-assist returned no text content');
      throw new ServiceUnavailableException('AI assistant returned an unexpected response');
    }

    return this.parseOutput(text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildSystemPrompt(): string {
    return [
      'You are a booking assistant on BII Localfinder, a local-services marketplace in Rwanda.',
      'A client describes the service they need in plain language, in English, Kinyarwanda, or French,',
      'and you turn that into fields for a service-request form. Respond with ONLY a single JSON object,',
      'no prose and no markdown fences, with exactly these keys:',
      '{"language": "en"|"rw"|"fr", "serviceKey": string, "title": string, "description": string,',
      '"preferredDate": "YYYY-MM-DD", "preferredTime": "HH:MM", "budgetMin": number, "budgetMax": number,',
      '"additionalNotes": string, "values": {"<field slug>": value}, "questions": string[], "reply": string}',
      '',
      'Rules:',
      '- Detect the client language among English, Kinyarwanda and French. Set "language" accordingly and',
      '  write "reply" and every question in that language.',
      '- Extract ONLY what the client actually said. Never invent details, dates, times, budgets, prices,',
      '  or provider availability. Omit any key you have no value for — an omitted field is better than a',
      '  guessed one. Never claim a provider is available and never quote a price.',
      '- "serviceKey" must be copied exactly from the provided services list, and only if the client need',
      '  clearly matches one entry. If nothing matches, omit it. If a service is locked, never suggest',
      '  another one. You cannot use a key that is not on the list.',
      '- "title" is a short (<= 90 char) summary of the job. "description" is a faithful rewrite of what',
      '  the client described (<= 2000 chars) — same intent, no added facts.',
      '- "preferredDate"/"preferredTime" only when the client gave a day or time (use "today" from the',
      '  payload to interpret relative dates like "tomorrow"). Budgets are RWF amounts only if stated.',
      '- "values": only keys from the provided field list (present only when a service is locked), and only',
      '  when a service is known. Exactly one option for SELECT, an array for MULTI_SELECT, true/false for',
      '  BOOLEAN. Never fabricate NUMBER or PRICE values.',
      '- Do NOT ask which service the client needs, nor for a missing title or description — the system',
      '  asks those automatically. Use "questions" (max 3) only for details you still need: date, time,',
      '  budget, category questions, or a genuine clarification.',
      '- "reply": 1-3 sentences acknowledging what you understood and what is still missing, in the',
      '  client language. Keep it short and do not repeat the questions verbatim.',
    ].join('\n');
  }

  // The model is instructed to return bare JSON (and the API is asked for
  // application/json), but never trust that blindly — strip a stray code
  // fence if one shows up anyway, and fail closed (caller treats a parse
  // failure as "no extracted fields") rather than ever passing malformed
  // data on.
  private parseOutput(raw: string): BookingAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as BookingAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Gemini booking-assist response');
      return {};
    }
  }
}
