import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  RequestAssistInput,
  RequestAssistProvider,
  RequestAssistSuggestion,
} from '../assist-provider.interface';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const REQUEST_TIMEOUT_MS = 20_000;

// Talks to the Anthropic Messages API directly over fetch (Node 20 has it
// built in) rather than pulling in an SDK dependency for one call site.
// Never called with anything other than pre-validated, size-capped input —
// see RequestAssistService. Its output is UNTRUSTED and re-validated by the
// caller; this class only parses JSON out of the model's text response.
@Injectable()
export class AnthropicAssistProvider implements RequestAssistProvider {
  private readonly logger = new Logger(AnthropicAssistProvider.name);
  private readonly apiKey = process.env.ANTHROPIC_API_KEY!;

  async suggest(input: RequestAssistInput): Promise<RequestAssistSuggestion> {
    const schema = input.attributes.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description ?? undefined,
      type: a.type,
      required: a.isRequired,
      options: a.options ?? undefined,
    }));

    const system = [
      'You help a client fill out a service request form on a local-services marketplace.',
      'You will be given a service category, a free-text job description (and maybe a photo), and a list of',
      'category-specific fields with their type and allowed options.',
      'Respond with ONLY a single JSON object, no prose, no markdown fences, matching exactly:',
      '{"title": string, "description": string, "values": { "<field slug>": <value> } }',
      '- "title" is a short (<= 80 char) summary of the job.',
      '- "description" is a clear rewrite of what the client described, in their own intent — do not invent facts.',
      '- Only include a key in "values" for a field you are reasonably confident about from the given text/image.',
      '- Omit a field entirely rather than guessing. Never fabricate a NUMBER or PRICE value that was not stated or clearly shown.',
      '- For SELECT fields the value must be exactly one of the given options; for MULTI_SELECT, an array of them.',
      '- For BOOLEAN fields use true or false only.',
    ].join('\n');

    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: JSON.stringify({
          category: input.categoryName,
          service: input.serviceName,
          clientDescription: input.clientText ?? '',
          fields: schema,
        }),
      },
    ];

    if (input.imageBase64 && input.imageMimeType) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: input.imageMimeType, data: input.imageBase64 },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: userContent }],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn(`Anthropic request-assist call failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('AI assist is temporarily unavailable');
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      this.logger.warn(`Anthropic request-assist call returned ${res.status}`);
      throw new ServiceUnavailableException('AI assist is temporarily unavailable');
    }

    const body = await res.json();
    const text = (body?.content ?? []).find((b: any) => b?.type === 'text')?.text;
    if (typeof text !== 'string') {
      throw new ServiceUnavailableException('AI assist returned an unexpected response');
    }

    return this.parseSuggestion(text);
  }

  // The model is instructed to return bare JSON, but never trust that
  // blindly — strip a stray code fence if one shows up anyway, and fail
  // closed (caller treats a parse failure as "no suggestions") rather than
  // ever passing malformed data on.
  private parseSuggestion(raw: string): RequestAssistSuggestion {
    const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        title: typeof parsed.title === 'string' ? parsed.title : undefined,
        description: typeof parsed.description === 'string' ? parsed.description : undefined,
        values: parsed.values && typeof parsed.values === 'object' ? parsed.values : {},
      };
    } catch {
      this.logger.warn('Could not parse JSON out of Anthropic request-assist response');
      return { values: {} };
    }
  }
}
