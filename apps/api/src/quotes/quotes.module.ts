import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [NotificationsModule, PersonalizationModule, FilesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
