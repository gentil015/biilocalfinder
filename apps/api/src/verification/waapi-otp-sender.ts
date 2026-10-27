import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ContactChannel } from '@prisma/client';
import { OtpSender } from './otp-sender';

@Injectable()
export class WaapiOtpSender implements OtpSender {
  private readonly logger = new Logger(WaapiOtpSender.name);

  async send(channel: ContactChannel, target: string, code: string): Promise<void> {
    const apiKey = process.env.WAAPI_API_KEY ?? process.env.WA_API_KEY;
    const instanceId = process.env.WAAPI_INSTANCE_ID ?? process.env.WA_INSTANCE_ID ?? process.env.WAAPI_ID;
    const baseUrl = process.env.WAAPI_BASE_URL ?? 'https://waapi.app/api/v1';

    const message = `Your Bii Localfinder verification code: ${code}. It expires in 10 minutes.`;

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('WAAPI credentials not configured — cannot send verification code.');
        throw new ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
      }
      this.logger.warn(`[dev only] ${channel} verification code for ${target}: ${code}`);
      return;
    }

    try {
      let res: Response;
      const attempts: Array<{ url: string; body: any; headers: Record<string, string> }> = [];

      if (instanceId) {
        attempts.push({
          url: `${baseUrl}/instances/${instanceId}/send-text`,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { to: target, message },
        });
        attempts.push({
          url: `https://waapi.app/api/v1/instances/${instanceId}/messages`,
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: { to: target, type: 'text', text: message },
        });
      }
      attempts.push(
        {
          url: `${baseUrl}/send-text`,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { to: target, message },
        },
        {
          url: `https://waapi.app/api/v1/messages/text`,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { to: target, body: message },
        },
        {
          url: `https://waapi.app/api/send`,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { phone: target, message },
        },
      );

      let lastText = '';
      for (const attempt of attempts) {
        try {
          res = await fetch(attempt.url, {
            method: 'POST',
            headers: attempt.headers,
            body: JSON.stringify(attempt.body),
          });
          if (res.ok) return;
          lastText = await res.text().catch(() => '');
          if (res.status !== 404) {
            this.logger.error(`WAAPI send failed (${res.status}): ${lastText}`);
            if (process.env.NODE_ENV === 'production') {
              throw new ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
            }
            return;
          }
        } catch (e) {
          // try next
        }
      }

      this.logger.error(`WAAPI send failed: ${lastText}`);
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
      }
      return;

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(`WAAPI send failed (${res.status}): ${text}`);
        if (process.env.NODE_ENV === 'production') {
          throw new ServiceUnavailableException('Verification messages cannot be sent right now. Please try again later.');
        }
      }
    } catch (err) {
      this.logger.error(`WAAPI request error: ${(err as Error).message}`);
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Verification messages cannot sent right now. Please try again later.');
      }
    }
  }
}
