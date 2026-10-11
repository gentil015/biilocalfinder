import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ContactChannel } from '@prisma/client';

// Email/SMS delivery sits behind this interface, like MapProvider and
// StorageService, so wiring a real provider (Africa's Talking, Twilio, SES…)
// means adding one class and rebinding OTP_SENDER — nothing else changes.
export interface OtpSender {
  send(channel: ContactChannel, target: string, code: string): Promise<void>;
}

export const OTP_SENDER = 'OTP_SENDER';

// Default binding until a real provider is configured. In development the
// code is written to the API log so the flow can be exercised end to end.
// In production it refuses to pretend a message was sent.
@Injectable()
export class LoggingOtpSender implements OtpSender {
  private readonly logger = new Logger('OtpSender');

  async send(channel: ContactChannel, target: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      this.logger.error(`No ${channel} delivery provider is configured — cannot send verification code.`);
      throw new ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
    }
    this.logger.warn(`[dev only] ${channel} verification code for ${target}: ${code}`);
  }
}
