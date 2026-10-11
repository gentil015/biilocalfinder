import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';

// Unlike email, Web Push has no vendor account to sign up for — it just
// needs a VAPID key pair (generate with `npx web-push generate-vapid-keys`,
// set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_CONTACT_EMAIL), so this
// is wired to a real implementation rather than a logging stand-in.
export interface PushSubscriptionTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

// Thrown for a subscription the push service says is gone (404/410) — the
// caller deletes the PushSubscription row rather than retrying it forever.
export class PushSubscriptionGoneError extends Error {}

export interface PushSender {
  send(target: PushSubscriptionTarget, message: PushMessage): Promise<void>;
  isConfigured(): boolean;
}

export const PUSH_SENDER = 'PUSH_SENDER';

@Injectable()
export class WebPushSender implements PushSender {
  private readonly logger = new Logger('PushSender');
  private configured = false;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const contact = process.env.VAPID_CONTACT_EMAIL;
    if (publicKey && privateKey && contact) {
      webpush.setVapidDetails(`mailto:${contact}`, publicKey, privateKey);
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async send(target: PushSubscriptionTarget, message: PushMessage): Promise<void> {
    if (!this.configured) {
      this.logger.warn(`[dev only, no VAPID keys set] push to ${target.endpoint.slice(0, 40)}…: ${message.title}`);
      return;
    }
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(message),
      );
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        throw new PushSubscriptionGoneError('Push subscription is no longer valid');
      }
      throw err;
    }
  }
}
