import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { SocketServerRegistry } from '../realtime/socket-server-registry.service';
import { NOTIFICATIONS_QUEUE, NotificationJobData, NotificationsService } from './notifications.service';
import { EMAIL_SENDER, EmailSender } from './channels/email-sender';
import { PUSH_SENDER, PushSender, PushSubscriptionGoneError } from './channels/push-sender';

// The one place that fans a notification out to every channel the user
// has opted into (spec §19 / §10: callers enqueue one job, channels are
// added here without any caller changing). In-app is the "does this even
// happen" gate — the DB row and realtime event are only created when the
// user's inApp preference for this category is on; push/email are then
// attempted independently based on their own preference + whether the
// user has a working destination for them (a saved push subscription, a
// verified email).
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private registry: SocketServerRegistry,
    private notifications: NotificationsService,
    @Inject(PUSH_SENDER) private pushSender: PushSender,
    @Inject(EMAIL_SENDER) private emailSender: EmailSender,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>) {
    const preference = await this.notifications.getEffectivePreferenceForType(job.data.userId, job.data.type);

    let notification = null;
    if (preference.inApp) {
      notification = await this.prisma.notification.create({
        data: {
          userId: job.data.userId,
          type: job.data.type,
          title: job.data.title,
          body: job.data.body,
          data: job.data.data as any,
        },
      });
      this.registry.emitToRoom(SocketServerRegistry.userRoom(job.data.userId), 'notification:new', notification);
    }

    if (preference.push) await this.dispatchPush(job.data);
    if (preference.email) await this.dispatchEmail(job.data);

    return notification;
  }

  private async dispatchPush(data: NotificationJobData) {
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId: data.userId } });
    for (const sub of subscriptions) {
      try {
        await this.pushSender.send(sub, { title: data.title, body: data.body, data: data.data });
      } catch (err) {
        if (err instanceof PushSubscriptionGoneError) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          this.logger.warn(`Push delivery failed for subscription ${sub.id}: ${(err as Error).message}`);
        }
      }
    }
  }

  private async dispatchEmail(data: NotificationJobData) {
    const user = await this.prisma.user.findUnique({ where: { id: data.userId }, select: { email: true, emailVerified: true } });
    if (!user?.emailVerified) return; // don't email an address nobody's confirmed owning
    try {
      await this.emailSender.send({ to: user.email, subject: data.title, body: data.body ?? data.title });
    } catch (err) {
      this.logger.warn(`Email delivery failed for user ${data.userId}: ${(err as Error).message}`);
    }
  }
}
