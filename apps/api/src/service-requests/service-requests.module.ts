import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { ServiceOfferingsModule } from '../service-offerings/service-offerings.module';
import { SearchModule } from '../search/search.module';
import { PROVIDER_MATCHING_QUEUE, ProviderMatchingService } from './provider-matching.service';
import { ProviderMatchingProcessor } from './provider-matching.processor';

@Module({
  imports: [
    NotificationsModule,
    PersonalizationModule,
    ServiceOfferingsModule,
    // EMBEDDING_PROVIDER + EmbeddingIndexService are exported by SearchModule
    // so the matcher can embed a request the same way search embeds a query.
    SearchModule,
    BullModule.registerQueue({ name: PROVIDER_MATCHING_QUEUE }),
  ],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, ProviderMatchingService, ProviderMatchingProcessor],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
