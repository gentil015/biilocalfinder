import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

export const BOOKING_REMINDER_QUEUE = 'booking-reminders';
// Reminded once, this far ahead of the scheduled time.
export const REMINDER_WINDOW_HOURS = 24;

// Runs hourly (registered in BookingsModule). A booking whose scheduledAt
// falls within the next REMINDER_WINDOW_HOURS, that hasn't been reminded
// yet, gets one BOOKING_REMINDER notification to both participants.
// reminderSentAt is the idempotency guard if two sweeps overlap.
@Processor(BOOKING_REMINDER_QUEUE)
export class BookingReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(BookingReminderProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    super();
  }

  async process() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    const due = await this.prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledAt: { gte: now, lte: windowEnd },
        reminderSentAt: null,
      },
      include: {
        client: { select: { userId: true } },
        provider: { select: { userId: true, businessName: true } },
      },
    });

    let reminded = 0;
    for (const booking of due) {
      // updateMany + the reminderSentAt: null guard makes this idempotent
      // if two sweeps overlap — same pattern as VerificationSweepProcessor.
      const res = await this.prisma.booking.updateMany({
        where: { id: booking.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (res.count === 0) continue;
      reminded++;

      const when = booking.scheduledAt!.toLocaleString();
      await this.notifications.notify({
        userId: booking.client.userId,
        type: 'BOOKING_REMINDER',
        title: 'Upcoming booking reminder',
        body: `Your booking with ${booking.provider.businessName} is coming up on ${when}.`,
        data: { bookingId: booking.id },
      });
      await this.notifications.notify({
        userId: booking.provider.userId,
        type: 'BOOKING_REMINDER',
        title: 'Upcoming booking reminder',
        body: `You have a booking scheduled for ${when}.`,
        data: { bookingId: booking.id },
      });
    }

    this.logger.log(`Booking reminder sweep: ${reminded} booking(s) reminded`);
    return { reminded };
  }
}
