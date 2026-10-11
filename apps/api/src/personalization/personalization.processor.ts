import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RecommendationCacheService } from './recommendation-cache.service';
import { PERSONALIZATION_QUEUE } from './interactions/interaction.service';

@Processor(PERSONALIZATION_QUEUE)
export class PersonalizationProcessor extends WorkerHost {
  constructor(private cache: RecommendationCacheService) {
    super();
  }

  async process(job: Job<{ userId: string }>) {
    if (job.name === 'invalidate-cache') {
      // Simply invalidating (rather than eagerly recomputing) keeps this
      // job cheap — the next GET /personalization/home naturally
      // recomputes and repopulates the cache on demand.
      await this.cache.invalidate(job.data.userId);
    }
  }
}
