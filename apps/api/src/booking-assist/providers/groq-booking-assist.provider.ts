import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  BookingAssistInput,
  BookingAssistOutput,
  BookingAssistProvider,
} from '../booking-assist.interface';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to the Groq chat-completions API directly over fetch (Node 20 has
// it built in) rather than pulling in an SDK dependency for one call site —
// same approach as GeminiBookingAssistProvider/AnthropicAssistProvider.
// The API key lives only in the backend environment (GROQ_API_KEY); it is
// sent as a Bearer header so it never appears in a URL that could be logged.
// Never called with anything other than pre-validated, size-capped input —
// see BookingAssistService. Its output is UNTRUSTED and re-validated by the
// caller; this class only parses JSON out of the model's text response.
@Injectable()
export class GroqBookingAssistProvider implements BookingAssistProvider {
  private readonly logger = new Logger(GroqBookingAssistProvider.name);
  private readonly apiKey = process.env.GROQ_API_KEY!;
  private readonly model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

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

    // Groq speaks OpenAI chat roles natively, so history maps straight
    // across; the latest client message is sent as the structured payload.
    const messages = [
      { role: 'system', content: system },
      ...input.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: payload },
    ];

    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            temperature: 0.2,
            max_tokens: 1024,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        lastStatus = 0;
        if (attempt === MAX_ATTEMPTS) {
          this.logger.warn(`Groq booking-assist call failed: ${(err as Error).message}`);
          throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
        }
        await this.delay(RETRY_DELAY_MS);
        continue;
      } finally {
        clearTimeout(timeout);
      }

      const raw = await res.text();
      lastStatus = res.status;
      if (res.ok) {
        return this.parseContent(raw);
      }

      // The body is logged (not just the status): a bare "429" told us
      // nothing last time — the quota message is in here.
      this.logger.warn(
        `Groq booking-assist call returned ${res.status}: ${raw.slice(0, 300)}`,
      );

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await this.delay(RETRY_DELAY_MS);
        continue;
      }
      throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
    }

    this.logger.warn(`Groq booking-assist exhausted retries (last status ${lastStatus})`);
    throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
  }

  private parseContent(raw: string): BookingAssistOutput {
    let text = '';
    try {
      const body = JSON.parse(raw);
      text = body?.choices?.[0]?.message?.content ?? '';
    } catch {
      text = '';
    }
    if (typeof text !== 'string' || !text.trim()) {
      this.logger.warn('Groq booking-assist returned no text content');
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

  // The model is instructed to return bare JSON, but never trust that
  // blindly — strip a stray code fence if one shows up anyway, and fail
  // closed (caller treats a parse failure as "no extracted fields") rather
  // than ever passing malformed data on.
  private parseOutput(raw: string): BookingAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as BookingAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Groq booking-assist response');
      return {};
    }
  }
}
