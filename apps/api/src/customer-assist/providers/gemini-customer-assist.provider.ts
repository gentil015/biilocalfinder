import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  CUSTOMER_ASSIST_SYSTEM_PROMPT,
  CustomerAssistInput,
  CustomerAssistOutput,
  CustomerAssistProvider,
} from '../customer-assist.interface';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to the Gemini generateContent API directly over fetch (Node 20 has
// it built in) rather than pulling in an SDK dependency — same approach as
// GeminiBookingAssistProvider. The API key lives only in the backend
// environment (GEMINI_API_KEY) and is sent as a header so it never appears
// in a URL that could be logged. Its output is UNTRUSTED and re-validated
// by the caller; this class only parses JSON out of the model's text
// response.
@Injectable()
export class GeminiCustomerAssistProvider implements CustomerAssistProvider {
  private readonly logger = new Logger(GeminiCustomerAssistProvider.name);
  private readonly apiKey = process.env.GEMINI_API_KEY!;
  private readonly model = DEFAULT_MODEL;

  async suggest(input: CustomerAssistInput): Promise<CustomerAssistOutput> {
    const system = CUSTOMER_ASSIST_SYSTEM_PROMPT.replace('{today}', new Date().toISOString().slice(0, 10));
    const payload = JSON.stringify({
      language: input.language,
      services: input.services,
      message: input.messages[input.messages.length - 1]?.text ?? '',
    });

    // Gemini alternates user/model turns; our history already ends with the
    // latest client message, and any 'assistant' role is mapped to 'model'.
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
          this.logger.warn(`Gemini customer-assist call failed: ${(err as Error).message}`);
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
        this.logger.warn(`Gemini customer-assist transient ${res.status}, retrying (${attempt}/${MAX_ATTEMPTS})`);
        await this.delay(RETRY_DELAY_MS);
        continue;
      }

      this.logger.warn(`Gemini customer-assist call returned ${lastStatus}`);
      throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
    }

    const body = await res!.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (!text) {
      this.logger.warn('Gemini customer-assist returned no text content');
      throw new ServiceUnavailableException('AI assistant returned an unexpected response');
    }

    return this.parseOutput(text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // The model is instructed to return bare JSON (and the API is asked for
  // application/json), but never trust that blindly — strip a stray code
  // fence if one shows up anyway, and fail closed rather than ever passing
  // malformed data on.
  private parseOutput(raw: string): CustomerAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as CustomerAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Gemini customer-assist response');
      return {};
    }
  }
}