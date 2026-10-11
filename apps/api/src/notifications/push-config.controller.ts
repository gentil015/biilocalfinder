import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// Public (no auth) — the frontend needs this to call
// PushManager.subscribe({ applicationServerKey }) before the user is even
// asked to grant permission.
@ApiTags('notifications')
@Controller('notifications')
export class PushConfigController {
  @Get('push-public-key')
  getPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null };
  }
}
