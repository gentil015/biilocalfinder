import { Injectable } from '@nestjs/common';
import {
  RequestAssistInput,
  RequestAssistProvider,
  RequestAssistSuggestion,
} from '../assist-provider.interface';

// Deterministic, keyword-based stand-in used when no ANTHROPIC_API_KEY is
// configured — keeps local dev, CI, and this sandbox's build/test pass
// fully offline, matching MockMapProvider/MockPaymentProvider (spec
// pattern: every external dependency has an offline mock behind the same
// interface).
@Injectable()
export class MockAssistProvider implements RequestAssistProvider {
  async suggest(input: RequestAssistInput): Promise<RequestAssistSuggestion> {
    const text = (input.clientText ?? '').toLowerCase();
    const values: Record<string, unknown> = {};

    for (const attr of input.attributes) {
      if (attr.type === 'BOOLEAN') {
        if (text.includes(attr.name.toLowerCase())) values[attr.slug] = true;
        continue;
      }
      if ((attr.type === 'SELECT' || attr.type === 'MULTI_SELECT') && attr.options?.length) {
        const hits = attr.options.filter((opt) => text.includes(opt.toLowerCase()));
        if (hits.length) values[attr.slug] = attr.type === 'SELECT' ? hits[0] : hits;
        continue;
      }
      // TEXT/NUMBER/PRICE: no reliable keyword heuristic — leave for the
      // client to fill in rather than guessing a number.
    }

    return {
      title: input.clientText ? this.guessTitle(input.serviceName, input.clientText) : undefined,
      description: input.clientText,
      values,
    };
  }

  private guessTitle(serviceName: string, text: string): string {
    const firstSentence = text.split(/[.!\n]/)[0].trim();
    return firstSentence.length > 0 && firstSentence.length <= 80 ? firstSentence : serviceName;
  }
}
