import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingStateMachine } from './booking-state-machine';
import { NotificationsModule } from '../notifications/notifications.module';
import { PersonalizationModule } from '../personalization/personalization.module';
import { BOOKING_REMINDER_QUEUE, BookingReminderProcessor } from './booking-reminder.processor';

@Module({
  imports: [
    NotificationsModule,
    PersonalizationModule,
    BullModule.registerQueue({ name: BOOKING_REMINDER_QUEUE }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingStateMachine, BookingReminderProcessor],
  exports: [BookingsService],
})
export class BookingsModule implements OnModuleInit {
  private readonly logger = new Logger(BookingsModule.name);

  constructor(@InjectQueue(BOOKING_REMINDER_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    try {
      // Idempotent upsert, same pattern as the verification sweep — safe
      // to boot several API instances without multiplying the job.
      await this.queue.upsertJobScheduler('booking-reminder-hourly', { pattern: '0 * * * *' }, { name: 'remind' });
    } catch (err) {
      this.logger.error('Could not schedule the hourly booking reminder sweep', err as Error);
    }
  }
}
