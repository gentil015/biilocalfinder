import { Module } from '@nestjs/common';
import { ServiceOfferingsController } from './service-offerings.controller';
import { ServiceOfferingsService } from './service-offerings.service';
import { CategoriesModule } from '../categories/categories.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { SearchModule } from '../search/search.module';

@Module({
  controllers: [ServiceOfferingsController],
  providers: [ServiceOfferingsService],
  exports: [ServiceOfferingsService],
})
export class ServiceOfferingsModule {}
