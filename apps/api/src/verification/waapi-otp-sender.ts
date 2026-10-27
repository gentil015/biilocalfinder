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
      if (instanceId) {
        res = await fetch(`${baseUrl}/instances/${instanceId}/send-text`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: target,
            message,
          }),
        });
      } else {
        res = await fetch(`${baseUrl}/send-text`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: target,
            message,
          }),
        });
      }

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
