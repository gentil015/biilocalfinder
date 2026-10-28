import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FilesModule } from '../files/files.module';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionProcessor } from './data-retention.processor';
import { DATA_RETENTION_QUEUE } from './data-retention.constants';

@Module({
  imports: [FilesModule, BullModule.registerQueue({ name: DATA_RETENTION_QUEUE })],
  controllers: [UsersController],
  providers: [UsersService, DataRetentionService, DataRetentionProcessor],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  private readonly logger = new Logger(UsersModule.name);

  constructor(@InjectQueue(DATA_RETENTION_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.upsertJobScheduler(
        'data-retention-daily-purge',
        { pattern: '30 3 * * *' },
        { name: 'purge' },
      );
    } catch (err) {
      this.logger.error('Could not schedule the daily data-retention purge', err as Error);
    }
  }
}
