import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { VERIFICATION_QUEUE } from './verification.constants';
import { VerificationService } from './verification.service';
import { ContactVerificationService } from './contact-verification.service';
import { VerificationSweepProcessor } from './verification-sweep.processor';
import { LoggingOtpSender, OTP_SENDER } from './otp-sender';
import {
  AdminVerificationController,
  ContactVerificationController,
  ProviderVerificationController,
} from './verification.controller';

@Module({
  imports: [NotificationsModule, FilesModule, BullModule.registerQueue({ name: VERIFICATION_QUEUE })],
  controllers: [ProviderVerificationController, ContactVerificationController, AdminVerificationController],
  providers: [
    VerificationService,
    ContactVerificationService,
    VerificationSweepProcessor,
    // Swap this binding for a real SMS/email provider when one is chosen.
    { provide: OTP_SENDER, useClass: LoggingOtpSender },
  ],
  exports: [VerificationService],
})
export class VerificationModule implements OnModuleInit {
  private readonly logger = new Logger(VerificationModule.name);

  constructor(@InjectQueue(VERIFICATION_QUEUE) private queue: Queue) {}

  async onModuleInit() {
    try {
      // Idempotent: the same scheduler id is upserted on every boot, so
      // running several API instances never multiplies the job.
      await this.queue.upsertJobScheduler('verification-daily-sweep', { pattern: '0 2 * * *' }, { name: 'sweep' });
    } catch (err) {
      this.logger.error('Could not schedule the daily verification sweep', err as Error);
    }
  }
}
