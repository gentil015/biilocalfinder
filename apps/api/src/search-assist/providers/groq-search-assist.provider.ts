import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SearchAssistInput, SearchAssistOutput, SearchAssistProvider } from '../search-assist.interface';
import { buildSearchSystemPrompt, buildSearchUserPayload } from '../search-assist.prompt';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to Groq's OpenAI-compatible chat completions API directly over fetch
// (Node 20 has it built in) rather than pulling in an SDK for one call site —
// same approach as GroqBookingAssistProvider. The API key lives only in the
// backend environment (GROQ_API_KEY) and is sent as a header so it never
// appears in a URL that could be logged. Its output is UNTRUSTED and
// re-validated by SearchAssistService; this class only parses JSON out of
// the model's text response.
@Injectable()
export class GroqSearchAssistProvider implements SearchAssistProvider {
  private readonly logger = new Logger(GroqSearchAssistProvider.name);
  private readonly apiKey = process.env.GROQ_API_KEY!;
  private readonly model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;

  async parse(input: SearchAssistInput): Promise<SearchAssistOutput> {
    const payload = buildSearchUserPayload(input);

    const messages = [
      { role: 'system', content: buildSearchSystemPrompt() },
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
          this.logger.warn(`Groq search-assist call failed: ${(err as Error).message}`);
          throw new ServiceUnavailableException('AI search is temporarily unavailable');
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

      // The body is logged, not just the status — a bare "429" told us
      // nothing last time, the quota message is in here.
      this.logger.warn(`Groq search-assist call returned ${res.status}: ${raw.slice(0, 300)}`);

      if (attempt < MAX_ATTEMPTS) {
        if (res.status === 429) {
          // TPM windows clear in ~20s and the body says exactly how long —
          // wait that out ONCE (a fixed 1.5s retry just burns the remaining
          // attempts against the same closed window). A second 429 means it
          // is not clearing soon: fail over to the plain-search fallback
          // instead of making the client watch a spinner for a minute.
          if (attempt === 1) {
            await this.delay(this.retryAfterMs(raw, res.headers));
            continue;
          }
          break;
        }
        if (res.status >= 500) {
          await this.delay(RETRY_DELAY_MS);
          continue;
        }
      }
      break;
    }

    this.logger.warn(`Groq search-assist giving up (last status ${lastStatus})`);
    throw new ServiceUnavailableException('AI search is temporarily unavailable');
  }

  private parseContent(raw: string): SearchAssistOutput {
    let content = '';
    try {
      content = JSON.parse(raw)?.choices?.[0]?.message?.content ?? '';
    } catch {
      this.logger.warn('Groq search-assist returned non-JSON body');
    }
    if (!content) {
      this.logger.warn('Groq search-assist returned no message content');
      throw new ServiceUnavailableException('AI search returned an unexpected response');
    }
    return this.parseOutput(content);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // How long a 429 actually asks us to wait: the standard header first,
  // then the human sentence Groq puts in the error body
  // ("Please try again in 22.365s"), then a sane default — always bounded
  // so a hostile/broken header cannot park the request open-ended.
  private retryAfterMs(raw: string, headers: Headers): number {
    const headerSeconds = Number(headers.get('retry-after'));
    if (Number.isFinite(headerSeconds) && headerSeconds > 0) return Math.min(headerSeconds, 30) * 1000;
    const match = /try again in ([\d.]+)s/.exec(raw);
    if (match) return Math.min(Math.max(Number(match[1]), 5), 30) * 1000;
    return 15_000;
  }

  // The model is instructed to return bare JSON, but never trust that
  // blindly — strip a stray code fence if one shows up anyway, and fail
  // closed (caller treats a parse failure as "no extracted criteria") rather
  // than ever passing malformed data on.
  private parseOutput(raw: string): SearchAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as SearchAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Groq search-assist response');
      return {};
    }
  }
}
