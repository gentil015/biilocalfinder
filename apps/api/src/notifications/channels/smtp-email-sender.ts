import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailMessage, EmailSender } from './email-sender';

// Real SMTP delivery, used whenever SMTP_HOST is configured. Bound in
// NotificationsModule (see the factory there) so EMAIL_SENDER stays the one
// thing callers inject: swapping Logging <-> SMTP is a binding change, not a
// code change in any caller.
//
// Kept deliberately dumb: no retry queue, no template engine, no provider
// SDK. Anything that needs those belongs in the notifications queue, not here.
@Injectable()
export class SmtpEmailSender implements EmailSender {
  private readonly logger = new Logger('SmtpEmailSender');

  private readonly transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // 465 is implicit TLS; 587 is STARTTLS. Defaulting to secure=false means
    // "upgrade via STARTTLS if the server offers it", which is what the usual
    // 587 relays expect.
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.transport.sendMail({
        from: process.env.EMAIL_FROM ?? 'Bii Localfinder <no-reply@bii.local>',
        to: message.to,
        subject: message.subject,
        text: message.body,
        html: message.html,
      });
    } catch (err) {
      // Deliberately does not leak the SMTP host/credentials in the log —
      // this line ends up in error trackers.
      this.logger.error(
        `Failed to send "${message.subject}" to ${message.to}: ${(err as Error).message}`,
      );
      // Surfaced as a 503 rather than swallowed: a silent failure here means
      // the user is told "check your email" for a message that was never sent.
      throw new ServiceUnavailableException('Email could not be sent right now. Please try again.');
    }
  }
}