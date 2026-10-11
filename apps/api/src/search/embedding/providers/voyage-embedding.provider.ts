import { Injectable, Logger } from '@nestjs/common';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingProvider,
} from '../embedding-provider.interface';

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-3-lite'; // 512-dim — must match EMBEDDING_DIMENSIONS
const REQUEST_TIMEOUT_MS = 10_000;

// Talks to Voyage AI directly over fetch, same "no SDK for one call site"
// approach as AnthropicAssistProvider. Voyage is Anthropic's recommended
// embeddings partner (Anthropic's own Messages API doesn't do embeddings).
//
// Used for BOTH indexing (EmbeddingIndexService, input_type "document")
// and querying (PostgresProviderSearchService, input_type "query") —
// Voyage's asymmetric input_type improves retrieval quality when the two
// sides of a search are phrased differently, e.g. "leaking tap in the
// kitchen" (query) vs. a listing titled "Emergency Plumbing Repairs"
// (document).
@Injectable()
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  private readonly logger = new Logger(VoyageEmbeddingProvider.name);
  private readonly apiKey = process.env.VOYAGE_API_KEY!;
  readonly modelName = MODEL;
  readonly dimensions = EMBEDDING_DIMENSIONS;

  async embed(text: string, intent: 'document' | 'query' = 'document'): Promise<number[] | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          input: [trimmed],
          input_type: intent,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      // Semantic search is a "best effort on top of" enhancement, never a
      // hard dependency — every call site treats a null return the same as
      // "no key configured" and falls back to keyword-only behavior.
      this.logger.warn(`Voyage embeddings call failed: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      this.logger.warn(`Voyage embeddings call returned ${res.status}`);
      return null;
    }

    const body = await res.json();
    const vector = body?.data?.[0]?.embedding;
    if (!Array.isArray(vector) || vector.length !== this.dimensions) {
      this.logger.warn('Voyage embeddings response had an unexpected shape');
      return null;
    }
    return vector as number[];
  }
}
