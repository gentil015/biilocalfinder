import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EMBEDDING_QUEUE, EmbeddingIndexService } from './embedding-index.service';

// Keeps embedding generation (a network call to the embeddings vendor) off
// the request/response path for creating or editing a service offering —
// same reasoning as PersonalizationProcessor for interaction recording.
@Processor(EMBEDDING_QUEUE)
export class EmbeddingIndexProcessor extends WorkerHost {
  constructor(private embeddingIndex: EmbeddingIndexService) {
    super();
  }

  async process(job: Job<{ offeringId: string }>) {
    if (job.name === 'reindex-offering') {
      await this.embeddingIndex.reindexOffering(job.data.offeringId);
    }
  }
}
