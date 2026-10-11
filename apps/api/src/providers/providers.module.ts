import { Module } from '@nestjs/common';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { AvailabilityModule } from '../availability/availability.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [NotificationsModule, PersonalizationModule, AvailabilityModule, SubscriptionsModule],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
