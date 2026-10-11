import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AvailabilityModule } from '../availability/availability.module';
import { SearchController } from './search.controller';
import { PostgresProviderSearchService } from './postgres-provider-search.service';
import { RuleBasedRankingService } from './rule-based-ranking.service';
import { PROVIDER_SEARCH_SERVICE } from './provider-search.interface';
import { EMBEDDING_PROVIDER } from './embedding/embedding-provider.interface';
import { VoyageEmbeddingProvider } from './embedding/providers/voyage-embedding.provider';
import { MockEmbeddingProvider } from './embedding/providers/mock-embedding.provider';
import { EMBEDDING_QUEUE, EmbeddingIndexService } from './embedding/embedding-index.service';
import { EmbeddingIndexProcessor } from './embedding/embedding-index.processor';

@Module({
  imports: [AvailabilityModule, BullModule.registerQueue({ name: EMBEDDING_QUEUE })],
  controllers: [SearchController],
  providers: [
    RuleBasedRankingService,
    PostgresProviderSearchService,
    // Swap this provider for OpenSearchProviderSearchService later — the
    // controller and frontend never need to know (spec §51).
    { provide: PROVIDER_SEARCH_SERVICE, useExisting: PostgresProviderSearchService },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: () => {
        // Falls back to the offline mock without a key so the app (and
        // this repo's build/test pass) runs fully offline in development,
        // same pattern as REQUEST_ASSIST_PROVIDER/MAP_PROVIDER.
        if (process.env.VOYAGE_API_KEY) return new VoyageEmbeddingProvider();
        return new MockEmbeddingProvider();
      },
    },
    EmbeddingIndexService,
    EmbeddingIndexProcessor,
  ],
  exports: [PROVIDER_SEARCH_SERVICE, PostgresProviderSearchService, RuleBasedRankingService, EmbeddingIndexService],
})
export class SearchModule {}
