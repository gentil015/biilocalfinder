import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactChannel } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OTP_SENDER, OtpSender } from './otp-sender';
import { VerificationService } from './verification.service';

export const CODE_TTL_MINUTES = 10;
export const MAX_CONFIRM_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_SENDS_PER_HOUR = 5;

@Injectable()
export class ContactVerificationService {
  constructor(
    private prisma: PrismaService,
    private verification: VerificationService,
    @Inject(OTP_SENDER) private sender: OtpSender,
  ) {}

  // Only a keyed hash of the code is stored. Binding userId + channel +
  // target into the hash means a code can't be replayed for a different
  // address, or by a different account.
  static hashCode(code: string, userId: string, channel: ContactChannel, target: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return crypto
      .createHmac('sha256', secret ?? 'dev-only-secret')
      .update(`${userId}:${channel}:${target}:${code}`)
      .digest('hex');
  }

  async request(userId: string, channel: ContactChannel, now = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const target = channel === 'EMAIL' ? user.email : user.phone;
    if (!target) throw new BadRequestException('Add a phone number to your account first');
    if ((channel === 'EMAIL' && user.emailVerified) || (channel === 'PHONE' && user.phoneVerified)) {
      throw new BadRequestException(`Your ${channel.toLowerCase()} is already verified`);
    }

    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recent = await this.prisma.contactVerificationCode.findMany({
      where: { userId, channel, createdAt: { gte: hourAgo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      throw new HttpException('Too many codes requested. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent[0] && now.getTime() - recent[0].createdAt.getTime() < RESEND_COOLDOWN_SECONDS * 1000) {
      throw new HttpException('Please wait a minute before requesting another code.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');

    // A new code invalidates any earlier unused ones.
    await this.prisma.contactVerificationCode.updateMany({
      where: { userId, channel, consumedAt: null },
      data: { consumedAt: now },
    });
    await this.prisma.contactVerificationCode.create({
      data: {
        userId,
        channel,
        target,
        codeHash: ContactVerificationService.hashCode(code, userId, channel, target),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
      },
    });

    await this.sender.send(channel, target, code);
    return { sent: true, expiresInMinutes: CODE_TTL_MINUTES };
  }

  async confirm(userId: string, channel: ContactChannel, code: string, now = new Date()) {
    const record = await this.prisma.contactVerificationCode.findFirst({
      where: { userId, channel, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('That code has expired. Request a new one.');
    if (record.attempts >= MAX_CONFIRM_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const actual = Buffer.from(ContactVerificationService.hashCode(code, userId, channel, record.target), 'hex');
    const ok = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!ok) {
      await this.prisma.contactVerificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code');
    }

    // The address may have changed since the code was sent — only verify
    // the one the code was actually delivered to.
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const current = channel === 'EMAIL' ? user.email : user.phone;
    if (current !== record.target) {
      throw new BadRequestException('Your contact details changed. Request a new code.');
    }

    await this.prisma.$transaction([
      this.prisma.contactVerificationCode.update({ where: { id: record.id }, data: { consumedAt: now } }),
      this.prisma.user.update({
        where: { id: userId },
        data: channel === 'EMAIL' ? { emailVerified: true } : { phoneVerified: true },
      }),
    ]);

    // Phone ownership is part of the "Verified Provider" rule.
    if (channel === 'PHONE') await this.verification.recomputeForUser(userId);

    return { verified: true, channel };
  }
}
