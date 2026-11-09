import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PROVIDER_MATCHING_QUEUE, ProviderMatchingService } from './provider-matching.service';

// Runs the provider fan-out off the client's request-creation path. The
// matching itself includes an embeddings call and a few candidate queries,
// so doing it inline would make "post a request" wait on work that does not
// improve the response.
@Processor(PROVIDER_MATCHING_QUEUE)
export class ProviderMatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(ProviderMatchingProcessor.name);

  constructor(private matching: ProviderMatchingService) {
    super();
  }

  async process(job: Job<{ requestId: string }>) {
    if (job.name !== 'match-request') return;
    try {
      return await this.matching.matchAndNotify(job.data.requestId);
    } catch (err) {
      // Matching is best-effort from the client's point of view: the request
      // is already created and valid without it. Log with the request id so
      // an operator can re-run it, rather than failing silently.
      this.logger.error(
        `Provider matching failed for request ${job.data.requestId}: ${(err as Error).message}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw err;
    }
  }
}
