import { Injectable } from '@nestjs/common';
import {
  EMBEDDING_DIMENSIONS,
  EmbeddingProvider,
} from '../embedding-provider.interface';

// Deterministic, offline stand-in used when no VOYAGE_API_KEY is
// configured — keeps local dev, CI, and this sandbox's build/test pass
// fully offline, matching MockAssistProvider/MockMapProvider/
// MockPaymentProvider (spec pattern: every external dependency has an
// offline mock behind the same interface).
//
// IMPORTANT — this is NOT semantic. It's feature hashing (a "hashing
// trick" bag-of-words): each token is hashed into one of 512 buckets and
// accumulated, so cosine similarity between two mock embeddings only
// reflects literal token overlap/stemming-free word matches, not meaning.
// "leaking tap" will NOT semantically match "dripping faucet" under this
// provider — that recall improvement only shows up with a real vendor key
// configured. What this mock DOES guarantee is that the whole pipeline
// (index -> store -> query -> rank) is exercised end-to-end offline, and
// that exact/near-exact word overlap still gets a relevance boost even
// without a key, so search degrades gracefully rather than breaking.
@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = 'mock-hashing-v1';
  readonly dimensions = EMBEDDING_DIMENSIONS;

  async embed(text: string): Promise<number[] | null> {
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1);
    if (tokens.length === 0) return null;

    const vector = new Array(this.dimensions).fill(0);
    for (const token of tokens) {
      const bucket = this.hash(token) % this.dimensions;
      // Sign hashing (a second hash bit picks +1/-1) reduces collision
      // bias compared to always incrementing the same direction.
      vector[bucket] += this.hash(token + '#sign') % 2 === 0 ? 1 : -1;
    }

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return null;
    return vector.map((v) => v / norm);
  }

  // Small, stable, non-cryptographic string hash (FNV-1a) — deterministic
  // across process restarts, which matters since embeddings are persisted
  // and compared against freshly hashed query text.
  private hash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}
