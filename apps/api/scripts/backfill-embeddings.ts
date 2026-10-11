// One-off backfill for offerings that predate this feature (or need
// re-embedding after switching providers/models — see
// EmbeddingProvider.modelName). Run once after deploying the pgvector
// migration and setting VOYAGE_API_KEY, same standalone-PrismaClient style
// as prisma/seed.ts. Ongoing indexing happens automatically via
// EmbeddingIndexService.enqueueReindex on offering create/update — this
// script is only for the historical backlog.
//
//   npm run embeddings:backfill
import { PrismaClient } from '@prisma/client';
import { EmbeddingIndexService } from '../src/search/embedding/embedding-index.service';
import { VoyageEmbeddingProvider } from '../src/search/embedding/providers/voyage-embedding.provider';
import { MockEmbeddingProvider } from '../src/search/embedding/providers/mock-embedding.provider';

async function main() {
  const prisma = new PrismaClient();
  const provider = process.env.VOYAGE_API_KEY ? new VoyageEmbeddingProvider() : new MockEmbeddingProvider();
  if (!process.env.VOYAGE_API_KEY) {
    console.warn(
      'VOYAGE_API_KEY is not set — backfilling with the offline hashing mock. ' +
        'Re-run this script after setting a real key to get true semantic recall.',
    );
  }

  // The queue argument is unused outside enqueueReindex(), which this
  // script never calls — a real Queue isn't needed for a one-off batch job.
  // PrismaService adds only the Nest lifecycle hooks to PrismaClient, and
  // reindexAll() uses none of them, so a standalone client stands in.
  const embeddingIndex = new EmbeddingIndexService(prisma as any, provider, undefined as any);

  console.log(`Backfilling offering embeddings with model "${provider.modelName}"...`);
  const { processed, skipped } = await embeddingIndex.reindexAll();
  console.log(`Done. Embedded ${processed} offerings, skipped ${skipped} (empty text or provider returned null).`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
