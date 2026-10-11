import { Module } from '@nestjs/common';
import { ServiceRequestsController } from './service-requests.controller';
import { ServiceRequestsService } from './service-requests.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { ServiceOfferingsModule } from '../service-offerings/service-offerings.module';

@Module({
  imports: [NotificationsModule, PersonalizationModule, ServiceOfferingsModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
  exports: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
