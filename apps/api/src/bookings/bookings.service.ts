import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InteractionService } from '../personalization/interactions/interaction.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { BookingStateMachine } from './booking-state-machine';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

const BOOKING_INCLUDE = {
  serviceRequest: { include: { service: true } },
  provider: { select: { id: true, businessName: true } },
  client: { include: { user: { select: { firstName: true, lastName: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private stateMachine: BookingStateMachine,
    private notifications: NotificationsService,
    private interactions: InteractionService,
    private providerContext: ProviderContextService,
  ) {}

  async findMine(userId: string, role: 'CLIENT' | 'PROVIDER') {
    if (role === 'CLIENT') {
      const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
      if (!clientProfile) throw new ForbiddenException('Client profile not found');
      return this.prisma.booking.findMany({
        where: { clientId: clientProfile.id },
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    const providerIds = await this.providerContext.getProviderIdsForUser(userId);
    if (providerIds.length === 0) throw new ForbiddenException('Provider profile not found');
    return this.prisma.booking.findMany({
      where: { providerId: { in: providerIds } },
      include: BOOKING_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!booking) throw new NotFoundException('Booking not found');
    const { role } = await this.assertParticipant(booking, userId);
    return { ...booking, viewerRole: role };
  }

  async updateStatus(id: string, userId: string, dto: UpdateBookingStatusDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const { role } = await this.assertParticipant(booking, userId);

    if (!this.stateMachine.canTransition(booking.status, dto.status)) {
      throw new BadRequestException(`Cannot move a booking from ${booking.status} to ${dto.status}`);
    }
    if (!this.stateMachine.actorAllowed(booking.status, dto.status, role)) {
      throw new ForbiddenException(`A ${role.toLowerCase()} cannot perform this transition`);
    }

    const extra: Record<string, unknown> = {};
    if (dto.status === 'COMPLETED') extra.completedAt = new Date();
    if (dto.status === 'CANCELLED') extra.cancelledAt = new Date();

    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({ where: { id }, data: { status: dto.status, ...extra } }),
      this.prisma.bookingStatusHistory.create({
        data: { bookingId: id, fromStatus: booking.status, toStatus: dto.status, note: dto.note },
      }),
    ]);

    const [client, provider] = await Promise.all([
      this.prisma.clientProfile.findUniqueOrThrow({
        where: { id: booking.clientId },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.provider.findUniqueOrThrow({ where: { id: booking.providerId } }),
    ]);
    const otherUserId = role === 'CLIENT' ? provider.userId : client.userId;
    const serviceName = await this.serviceName(booking.serviceRequestId);
    const statusLabel = BOOKING_STATUS_LABELS[dto.status] ?? dto.status.toLowerCase();
    await this.notifications.notify({
      userId: otherUserId,
      type: dto.status === 'COMPLETED' ? 'BOOKING_COMPLETED' : 'BOOKING_UPDATED',
      title: dto.status === 'COMPLETED' ? 'Booking completed' : `Booking ${statusLabel}`,
      body:
        dto.status === 'COMPLETED'
          ? `Your booking for ${serviceName} with ${counterpartName(role, provider.businessName, client)} has been marked complete.`
          : `Your booking for ${serviceName} with ${counterpartName(role, provider.businessName, client)} is now ${statusLabel}.`,
      data: { bookingId: id },
    });

    if (dto.status === 'COMPLETED') {
      await this.interactions.record(client.userId, 'COMPLETE_BOOKING', 'BOOKING', id);
    } else if (dto.status === 'CANCELLED') {
      await this.interactions.record(client.userId, 'CANCEL_BOOKING', 'BOOKING', id);
    }

    return updated;
  }

  private async assertParticipant(
    booking: { clientId: string; providerId: string },
    userId: string,
  ): Promise<{ role: 'CLIENT' | 'PROVIDER' }> {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (clientProfile && booking.clientId === clientProfile.id) return { role: 'CLIENT' };
    if (await this.providerContext.userHasAccessToProvider(userId, booking.providerId)) return { role: 'PROVIDER' };
    throw new ForbiddenException('Not authorized for this booking');
  }

  private async serviceName(serviceRequestId: string): Promise<string> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      select: { service: { select: { name: true } } },
    });
    return request?.service?.name ?? 'your service';
  }
}

// Plain-language labels for the status a booking just moved into, used in the
// notification title/body so the recipient reads "Booking confirmed" rather
// than the raw enum ("CONFIRMED").
const BOOKING_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: 'accepted',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// Names the party the *recipient* cares about. The actor performed the
// transition, so the recipient is the other side: a client acting means the
// provider is notified (and should see the client's name), and vice versa.
function counterpartName(
  actorRole: 'CLIENT' | 'PROVIDER',
  providerBusinessName: string,
  client: { user: { firstName: string; lastName: string } },
): string {
  if (actorRole === 'CLIENT') return clientName(client);
  return providerBusinessName;
}

function clientName(client: { user: { firstName: string; lastName: string } }): string {
  const name = `${client.user.firstName ?? ''} ${client.user.lastName ?? ''}`.trim();
  return name || 'your client';
}
