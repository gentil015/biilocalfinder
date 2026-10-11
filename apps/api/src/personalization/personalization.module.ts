import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SearchModule } from '../search/search.module';
import { PersonalizationController } from './personalization.controller';
import { PersonalizationService } from './personalization.service';
import { PersonalizationProcessor } from './personalization.processor';
import { RecommendationCacheService } from './recommendation-cache.service';
import { RecommendationService } from './recommendation/recommendation.service';
import { RankingConfigService } from './recommendation/ranking-config.service';
import { RECOMMENDATION_ENGINE } from './recommendation/recommendation.types';
import { InteractionService, PERSONALIZATION_QUEUE } from './interactions/interaction.service';
import { InteractionController } from './interactions/interaction.controller';
import { PreferenceService } from './preferences/preference.service';
import { PreferenceController } from './preferences/preference.controller';
import { ProviderAnalyticsService } from './analytics/provider-analytics.service';

// Deliberately separate from providers/services/bookings/search (spec §1):
// this module only *reads* from ProviderSearchService (via SearchModule)
// and Prisma directly. Everything else — favorites, service requests,
// quotes, bookings — depends on *this* module (importing InteractionService
// the same way they already import NotificationsService), never the other
// way around. No circular imports anywhere in the personalization graph.
@Module({
  imports: [SearchModule, BullModule.registerQueue({ name: PERSONALIZATION_QUEUE })],
  controllers: [PersonalizationController, InteractionController, PreferenceController],
  providers: [
    PersonalizationService,
    PersonalizationProcessor,
    RecommendationCacheService,
    RecommendationService,
    { provide: RECOMMENDATION_ENGINE, useExisting: RecommendationService },
    RankingConfigService,
    InteractionService,
    PreferenceService,
    ProviderAnalyticsService,
  ],
  exports: [InteractionService, PreferenceService, RecommendationService],
})
export class PersonalizationModule {}
