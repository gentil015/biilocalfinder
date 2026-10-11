import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SearchAssistInput, SearchAssistOutput, SearchAssistProvider } from '../search-assist.interface';
import { buildSearchSystemPrompt, buildSearchUserPayload } from '../search-assist.prompt';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

// Talks to the Gemini generateContent API directly over fetch (Node 20 has
// it built in) rather than pulling in an SDK dependency for one call site —
// same approach as GeminiBookingAssistProvider. The API key lives only in
// the backend environment (GEMINI_API_KEY); it is sent as a header so it
// never appears in a URL that could be logged. Its output is UNTRUSTED and
// re-validated by SearchAssistService; this class only parses JSON out of
// the model's text response.
@Injectable()
export class GeminiSearchAssistProvider implements SearchAssistProvider {
  private readonly logger = new Logger(GeminiSearchAssistProvider.name);
  private readonly apiKey = process.env.GEMINI_API_KEY!;
  private readonly model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  async parse(input: SearchAssistInput): Promise<SearchAssistOutput> {
    const system = buildSearchSystemPrompt();
    const payload = buildSearchUserPayload(input);

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
            contents: [{ role: 'user', parts: [{ text: payload }] }],
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
          this.logger.warn(`Gemini search-assist call failed: ${(err as Error).message}`);
          throw new ServiceUnavailableException('AI search is temporarily unavailable');
        }
        await this.delay(RETRY_DELAY_MS);
        continue;
      } finally {
        clearTimeout(timeout);
      }

      lastStatus = res.status;
      if (res.ok) break;

      if ((res.status === 429 || res.status === 503) && attempt < MAX_ATTEMPTS) {
        this.logger.warn(`Gemini search-assist transient ${res.status}, retrying (${attempt}/${MAX_ATTEMPTS})`);
        await this.delay(RETRY_DELAY_MS);
        continue;
      }

      this.logger.warn(`Gemini search-assist call returned ${lastStatus}`);
      throw new ServiceUnavailableException('AI search is temporarily unavailable');
    }

    const body = await res!.json();
    const parts = body?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
    if (!text) {
      this.logger.warn('Gemini search-assist returned no text content');
      throw new ServiceUnavailableException('AI search returned an unexpected response');
    }

    return this.parseOutput(text);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // The model is instructed to return bare JSON (and the API is asked for
  // application/json), but never trust that blindly — strip a stray code
  // fence if one shows up anyway, and fail closed (caller treats a parse
  // failure as "no extracted criteria") rather than ever passing malformed
  // data on.
  private parseOutput(raw: string): SearchAssistOutput {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' ? (parsed as SearchAssistOutput) : {};
    } catch {
      this.logger.warn('Could not parse JSON out of Gemini search-assist response');
      return {};
    }
  }
}
