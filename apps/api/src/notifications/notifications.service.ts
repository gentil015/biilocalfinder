import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationCategory, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CATEGORY_LABELS, DEFAULT_PREFERENCE, NOTIFICATION_TYPE_CATEGORY } from './notification-categories';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { RegisterPushSubscriptionDto } from './dto/register-push-subscription.dto';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface NotificationJobData {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private queue: Queue<NotificationJobData>,
  ) {}

  // Callers (ServiceRequests/Quotes/Bookings/Reviews/Verification/
  // Favorites/SavedSearches) just enqueue a job — they never touch
  // in-app/push/email directly or check the user's preferences themselves;
  // NotificationsProcessor is the one place that fans out to channels.
  async notify(data: NotificationJobData) {
    await this.queue.add('dispatch', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async findMine(userId: string, page = 1, limit = 20) {
    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, total, unreadCount, page, limit };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  // ---------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------

  // A missing row means "use the defaults" (schema.prisma column defaults
  // == DEFAULT_PREFERENCE) — every category still appears with a sensible
  // state on first visit, without a signup-time job populating every row
  // for every user.
  async getPreferences(userId: string) {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byCategory = new Map(rows.map((r: any) => [r.category, r]));
    return (Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => {
      const row = byCategory.get(category) as any;
      return {
        category,
        ...CATEGORY_LABELS[category],
        inApp: row?.inApp ?? DEFAULT_PREFERENCE.inApp,
        push: row?.push ?? DEFAULT_PREFERENCE.push,
        email: row?.email ?? DEFAULT_PREFERENCE.email,
      };
    });
  }

  async updatePreference(userId: string, dto: UpdatePreferenceDto) {
    await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category: dto.category } },
      create: { userId, category: dto.category, inApp: dto.inApp, push: dto.push, email: dto.email },
      update: { inApp: dto.inApp, push: dto.push, email: dto.email },
    });
    return this.getPreferences(userId);
  }

  // Used by NotificationsProcessor — resolves a NotificationType straight
  // to the effective preference, so callers never need to know about
  // NOTIFICATION_TYPE_CATEGORY themselves.
  async getEffectivePreferenceForType(userId: string, type: NotificationType) {
    const category = NOTIFICATION_TYPE_CATEGORY[type];
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId_category: { userId, category } },
    }) as any;
    return {
      category,
      inApp: row?.inApp ?? DEFAULT_PREFERENCE.inApp,
      push: row?.push ?? DEFAULT_PREFERENCE.push,
      email: row?.email ?? DEFAULT_PREFERENCE.email,
    };
  }

  // ---------------------------------------------------------------------
  // Push subscriptions
  // ---------------------------------------------------------------------

  async registerPushSubscription(userId: string, dto: RegisterPushSubscriptionDto) {
    // A browser can re-register the same endpoint (e.g. after clearing
    // permission and re-subscribing); upsert on the unique endpoint rather
    // than erroring, and re-point it at whichever user asked most recently.
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
    });
  }

  async removePushSubscription(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { success: true };
  }
}
