// Business logic never talks to an embeddings vendor directly — only
// through this interface, matching RequestAssistProvider/MapProvider/
// PaymentProvider, so the vendor can be swapped (or a future
// self-hosted model dropped in) without touching EmbeddingIndexService or
// PostgresProviderSearchService.
export interface EmbeddingProvider {
  readonly modelName: string;
  // Must always equal EMBEDDING_DIMENSIONS below — the pgvector column
  // (manual-sql/006_add_pgvector.sql) is a fixed-width vector(512), so any
  // provider plugged in here has to produce 512-dim output (voyage-3-lite
  // truncated/padded, or a matching model).
  readonly dimensions: number;

  // Returns null (never throws) when the vendor call itself fails, so
  // callers can decide once, in one place, what "no embedding available"
  // means for them — EmbeddingIndexService skips the write, and
  // PostgresProviderSearchService falls back to keyword-only search.
  //
  // `intent` lets a provider embed a short search query differently from a
  // longer listing description (Voyage's asymmetric input_type) — optional
  // so implementations that don't support it (MockEmbeddingProvider) can
  // just ignore it. Defaults to 'document' for existing call sites.
  embed(text: string, intent?: 'document' | 'query'): Promise<number[] | null>;
}

export const EMBEDDING_PROVIDER = 'EMBEDDING_PROVIDER';
export const EMBEDDING_DIMENSIONS = 512;
export const MAX_EMBEDDING_TEXT_LENGTH = 2000;
