import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  CUSTOMER_ASSIST_SYSTEM_PROMPT,
  CustomerAssistInput,
  CustomerAssistOutput,
  CustomerAssistProvider,
} from '../customer-assist.interface';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to the Groq chat-completions API directly over fetch (Node 20 has
// it built in) rather than pulling in an SDK dependency — same approach as
// GroqBookingAssistProvider. The API key lives only in the backend
// environment (GROQ_API_KEY) and is sent as a Bearer header so it never
// appears in a URL that could be logged. Its output is UNTRUSTED and
// re-validated by the caller; this class only parses JSON out of the
// model's text response.
@Injectable()
export class GroqCustomerAssistProvider implements CustomerAssistProvider {
  private readonly logger = new Logger(GroqCustomerAssistProvider.name);
  private readonly apiKey = process.env.GROQ_API_KEY!;
  private readonly model = DEFAULT_MODEL;

  async suggest(input: CustomerAssistInput): Promise<CustomerAssistOutput> {
    const system = CUSTOMER_ASSIST_SYSTEM_PROMPT.replace('{today}', new Date().toISOString().slice(0, 10));
    const payload = JSON.stringify({
      language: input.language,
      services: input.services,
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
          this.logger.warn(`Groq customer-assist call failed: ${(err as Error).message}`);
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

      this.logger.warn(`Groq customer-assist call returned ${res.status}: ${raw.slice(0, 300)}`);

      if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
        await this.delay(RETRY_DELAY_MS);
        continue;
      }
      throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
    }

    this.logger.warn(`Groq customer-assist exhausted retries (last status ${lastStatus})`);
    throw new ServiceUnavailableException('AI assistant is temporarily unavailable');
  }

  private parseContent(raw: string): CustomerAssistOutput {
    let text = '';
    try {
      const body = JSON.parse(raw);
      text = body?.choices?.[0]?.message?.content ?? '';
    } catch {
      text = '';
    }
    if (typeof text !== 'string' || !text.trim()) {
      this.logger.warn('Groq customer-assist returned no text content');
      throw new ServiceUnavailableException('AI assistant returned an unexpected response');
    }
    return this.parseOutput(text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // The model is instructed to return bare JSON, but never trust that
  // blindly — strip a stray code fence if one shows up anyway, and fail
  // closed (caller treats a parse failure as "no routed service") rather
  // than ever passing malformed data on.
  private parseOutput(raw: string): CustomerAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as CustomerAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Groq customer-assist response');
      return {};
    }
  }
}