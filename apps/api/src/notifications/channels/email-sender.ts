import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

// Same shape as verification/otp-sender.ts's OtpSender — swapping in a real
// provider (SES, SendGrid, Postmark…) means one new class + rebinding
// EMAIL_SENDER, nothing else changes. Deliberately not wired to a real
// provider here (spec §10: "Don't implement every channel immediately") —
// this scaffolds the channel so NotificationsProcessor can call it today
// and a real sender drops in later without touching any caller.
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  // Optional rich-text alternative. Callers that only set `body` stay
  // plain-text — every real client renders `text` as the fallback.
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER = 'EMAIL_SENDER';

@Injectable()
export class LoggingEmailSender implements EmailSender {
  private readonly logger = new Logger('EmailSender');

  async send(message: EmailMessage): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`No email delivery provider is configured — cannot email ${message.to}.`);
      throw new ServiceUnavailableException('Email could not be sent right now.');
    }
    this.logger.warn(`[dev only] email to ${message.to}: ${message.subject} — ${message.body}`);
  }
}
