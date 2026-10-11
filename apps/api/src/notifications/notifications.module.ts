import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { PushConfigController } from './push-config.controller';
import { NotificationsService, NOTIFICATIONS_QUEUE } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { EMAIL_SENDER, EmailSender, LoggingEmailSender } from './channels/email-sender';
import { SmtpEmailSender } from './channels/smtp-email-sender';
import { PUSH_SENDER, WebPushSender } from './channels/push-sender';

// SMTP_HOST is the switch: with it set, mail really goes out; without it we
// fall back to the logging sender so the flow (and password reset) stays
// exercisable in development. Resolved in a factory rather than with a static
// useClass so the choice is data, not a code edit.
function provideEmailSender(): { provide: string; useFactory: () => EmailSender } {
  return {
    provide: EMAIL_SENDER,
    useFactory: (): EmailSender =>
      process.env.SMTP_HOST ? new SmtpEmailSender() : new LoggingEmailSender(),
  };
}

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationsController, PushConfigController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    // Swap these bindings for real providers as they're wired up — see
    // channels/email-sender.ts and channels/push-sender.ts.
    provideEmailSender(),
    { provide: PUSH_SENDER, useClass: WebPushSender },
  ],
  // EMAIL_SENDER is exported so non-notification modules (e.g. AuthModule's
  // password reset) can send mail without importing NotificationsService and
  // coupling themselves to the notification queue.
  exports: [NotificationsService, EMAIL_SENDER],
})
export class NotificationsModule {}
