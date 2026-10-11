-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding column on service_offerings, kept separate from Prisma-managed
-- columns — same pattern as `geom` in 001_add_postgis.sql: Prisma has no
-- native vector type, so this is added via raw SQL and only ever touched
-- with $executeRaw/$queryRaw (see EmbeddingIndexService and
-- PostgresProviderSearchService's semantic branch), never through the
-- Prisma client directly.
--
-- 512 dimensions matches voyage-3-lite (the default real provider — see
-- VoyageEmbeddingProvider) and MockEmbeddingProvider's offline fallback.
-- If EMBEDDING_DIMENSIONS in embedding-provider.interface.ts ever changes,
-- this column (and the index below) must be recreated to match.
ALTER TABLE "service_offerings" ADD COLUMN IF NOT EXISTS embedding vector(512);
ALTER TABLE "service_offerings" ADD COLUMN IF NOT EXISTS "embeddingModel" text;
ALTER TABLE "service_offerings" ADD COLUMN IF NOT EXISTS "embeddingUpdatedAt" timestamptz;

-- Approximate nearest-neighbor index, cosine distance — matches the `<=>`
-- operator used by the semantic branch of PostgresProviderSearchService.
-- HNSW (rather than IVFFlat) needs no training/list-count tuning and is
-- fine at this table's expected size.
CREATE INDEX IF NOT EXISTS service_offerings_embedding_idx
  ON "service_offerings" USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
