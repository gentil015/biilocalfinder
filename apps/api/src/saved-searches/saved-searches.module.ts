import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SavedSearchesController } from './saved-searches.controller';
import { SavedSearchesService } from './saved-searches.service';
import { SavedSearchSweepProcessor, SAVED_SEARCH_QUEUE } from './saved-search-sweep.processor';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: SAVED_SEARCH_QUEUE })],
  controllers: [SavedSearchesController],
  providers: [SavedSearchesService, SavedSearchSweepProcessor],
  exports: [SavedSearchesService],
})
export class SavedSearchesModule implements OnModuleInit {
  private readonly logger = new Logger(SavedSearchesModule.name);

  constructor(@InjectQueue(SAVED_SEARCH_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.upsertJobScheduler('saved-search-daily-sweep', { pattern: '0 6 * * *' }, { name: 'sweep' });
    } catch (err) {
      this.logger.error('Could not schedule the daily saved-search sweep', err as Error);
    }
  }
}
