import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InteractionService } from '../personalization/interactions/interaction.service';
import { ServiceOfferingsService } from '../service-offerings/service-offerings.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { WorkspaceContextService } from '../common/workspace/workspace-context.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';

const REQUEST_INCLUDE = {
  service: { include: { category: true } },
  serviceOffering: true,
  // The pinned provider, when the client addressed the request to one
  // provider instead of broadcasting it: `providerId` is the governance
  // flag. A direct request is private to the client and that provider —
  // only they can view it, only they can quote it — UNLESS the client also
  // sets `isPublic`, which opens the same request to other matching
  // providers so they can compete (the pinned provider stays primary).
  provider: { select: { id: true, businessName: true } },
  // Present once the client accepts a quote, so every request surface can
  // link straight to the booking instead of asking the user to hunt for it.
  booking: { select: { id: true, status: true, scheduledAt: true, providerId: true } },
  images: true,
  location: true,
  client: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
  assignedMembership: {
    select: {
      id: true,
      userId: true,
      role: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  },
  attributeSnapshots: true,
} as const;

// A request can still take quotes (new ones, or negotiation on existing
// ones) in these statuses. BOOKED/CANCELLED leave the marketplace.
const ACCEPTING_STATUSES = ['OPEN', 'QUOTED', 'NEGOTIATING'] as const;
type AcceptingStatus = (typeof ACCEPTING_STATUSES)[number];

// Enough quote detail for a list to answer "did anyone respond yet?" and
// "what did they offer?" without pulling the full negotiation thread.
const QUOTE_SUMMARY_SELECT = {
  id: true,
  status: true,
  price: true,
  currency: true,
  proposedDate: true,
  createdAt: true,
  provider: { select: { id: true, businessName: true } },
} as const;

interface MarketRequestShape {
  id: string;
  clientId: string;
  providerId: string | null;
  serviceId: string;
  status: string;
  isPublic: boolean;
  assignedMembershipId?: string | null;
}

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private interactions: InteractionService,
    private offerings: ServiceOfferingsService,
    private providerContext: ProviderContextService,
    private workspaceContext?: WorkspaceContextService,
  ) {}

  async create(clientUserId: string, dto: CreateServiceRequestDto) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    if (!clientProfile) throw new ForbiddenException('Only clients can create service requests');

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || !service.isActive) throw new BadRequestException('Service not found');

    let providerId = dto.providerId;

    // Picking a specific offering (e.g. "Wedding Photography" from a
    // provider's profile) pins the exact provider+service — spec §20.
    if (dto.serviceOfferingId) {
      const offering = await this.prisma.serviceOffering.findUnique({ where: { id: dto.serviceOfferingId } });
      if (!offering || !offering.isActive) throw new BadRequestException('Service offering not found');
      if (offering.serviceId !== dto.serviceId) {
        throw new BadRequestException('This offering does not match the selected service');
      }
      providerId = offering.providerId;
    } else if (dto.providerId) {
      const provider = await this.prisma.provider.findUnique({ where: { id: dto.providerId } });
      if (!provider) throw new BadRequestException('Provider not found');
    }

    // Category-specific answers are validated the same way an offering's
    // own attribute values are (spec §25-26), then frozen into a snapshot
    // (spec §21) so the request stays meaningful even if an admin later
    // changes the category's attributes.
    const normalizedValues = dto.attributeValues
      ? await this.offerings.validateAttributeValues(service.categoryId, dto.attributeValues, { partial: true })
      : [];

    const request = await this.prisma.serviceRequest.create({
      data: {
        clientId: clientProfile.id,
        serviceId: dto.serviceId,
        serviceOfferingId: dto.serviceOfferingId,
        providerId,
        // isPublic is only meaningful on a direct (pinned) request: opening
        // it invites competing quotes from other matching providers. A
        // broadcast has no pinned provider and is public by construction, so
        // the flag is forced off there (it would otherwise read as "opened",
        // widening marketplace exposure later).
        isPublic: !!providerId && dto.isPublic === true,
        title: dto.title,
        description: dto.description,
        preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : undefined,
        preferredTime: dto.preferredTime,
        budgetMin: dto.budgetMin,
        budgetMax: dto.budgetMax,
        additionalNotes: dto.additionalNotes,
        locationId: dto.locationId,
        images: dto.images?.length
          ? {
              // File upload/storage is implemented as its own module later;
              // for now the frontend uploads directly and passes back URLs.
              create: dto.images.map((url) => ({ url, storageKey: url })),
            }
          : undefined,
        attributeSnapshots: normalizedValues.length
          ? {
              create: normalizedValues.map((v) => ({
                attributeName: v.attributeName,
                attributeValue: v.displayValue,
              })),
            }
          : undefined,
      },
      include: REQUEST_INCLUDE,
    });

    // A conversation is created alongside the request so client/provider can
    // message immediately (Phase 5 wires the realtime layer on top of this).
    if (providerId) {
      await this.prisma.conversation.create({
        data: {
          serviceRequestId: request.id,
          participants: {
            create: [{ clientId: clientProfile.id }, { providerId }],
          },
        },
      });

      const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
      if (provider) {
        await this.notifications.notify({
          userId: provider.userId,
          type: 'NEW_SERVICE_REQUEST',
          title: 'New service request',
          body: dto.title,
          data: { requestId: request.id },
        });
      }
    }

    await this.interactions.record(clientUserId, 'CREATE_SERVICE_REQUEST', 'SERVICE_REQUEST', request.id);

    return request;
  }

  async findMine(clientUserId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    if (!clientProfile) throw new ForbiddenException('Client profile not found');

    return this.prisma.serviceRequest.findMany({
      where: { clientId: clientProfile.id },
      include: {
        ...REQUEST_INCLUDE,
        // The client owns the request, so all quotes are theirs to compare.
        quotes: { select: QUOTE_SUMMARY_SELECT, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // hard cap — never return unlimited records (spec §43)
    });
  }

  // Requests explicitly addressed to this provider, plus open/broadcast
  // requests for a service the provider offers.
  async findIncoming(providerUserId: string) {
    // Was `findUnique({ where: { userId: providerUserId } })` — a
    // PrismaClientValidationError at runtime now that Provider.userId isn't
    // @unique (manual-sql/010), so this 500'd. Resolve through
    // ProviderContextService, then re-fetch by id for the `services` relation.
    const resolved = await this.providerContext.resolveForUser(providerUserId).catch(() => null);
    if (!resolved) throw new ForbiddenException('Provider profile not found');

    const provider = await this.prisma.provider.findUniqueOrThrow({
      where: { id: resolved.id },
      include: { services: true },
    });

    const serviceIds = provider.services.map((s: (typeof provider.services)[number]) => s.serviceId);
    const active = this.workspaceContext?.getForUser(providerUserId);
    const memberScope = active?.role === 'MEMBER' ? { assignedMembershipId: active.membershipId } : {};

    return this.prisma.serviceRequest.findMany({
      where: {
        ...memberScope,
        OR: [
          // Requests explicitly addressed to this provider while they still
          // need a response. Closed direct requests drop out of the inbox
          // instead of lingering there forever (see the next clause for the
          // ones this provider actually participated in).
          { providerId: provider.id, status: { in: [...ACCEPTING_STATUSES] } },
          // A request this provider already quoted — keep it visible after
          // it is booked or cancelled so they can follow the outcome.
          { providerId: provider.id, quotes: { some: { providerId: provider.id } } },
          // The legacy broadcast marketplace: a request sent to no one in
          // particular, visible to every provider of the service while OPEN.
          { providerId: null, serviceId: { in: serviceIds }, status: 'OPEN' },
          // A direct request the client opened to competition: any other
          // provider of the service may see and quote it while it still
          // accepts quotes. The pinned provider's own copy is covered above.
          {
            providerId: { not: provider.id },
            isPublic: true,
            serviceId: { in: serviceIds },
            status: { in: [...ACCEPTING_STATUSES] },
          },
        ],
      },
      include: {
        ...REQUEST_INCLUDE,
        // Only this provider's own quote: competing offers stay private.
        quotes: {
          where: { providerId: provider.id },
          select: QUOTE_SUMMARY_SELECT,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({ where: { id }, include: REQUEST_INCLUDE });
    if (!request) throw new NotFoundException('Service request not found');
    await this.assertParticipant(request, userId);
    return request;
  }

  async cancel(id: string, clientUserId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: { quotes: { select: { providerId: true } } },
    });
    if (!request || !clientProfile || request.clientId !== clientProfile.id) {
      throw new NotFoundException('Service request not found');
    }
    if (!ACCEPTING_STATUSES.includes(request.status as AcceptingStatus)) {
      throw new BadRequestException('This request can no longer be cancelled');
    }

    // Cancelling strands nobody: pending quotes are closed with the request,
    // and every provider who was addressed or already quoted is told why the
    // conversation stopped instead of silently disappearing from their inbox.
    const providerIds = [
      ...new Set<string>([
        ...(request.providerId ? [request.providerId] : []),
        ...request.quotes.map((q) => q.providerId),
      ]),
    ];

    const [updated] = await this.prisma.$transaction([
      this.prisma.serviceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: REQUEST_INCLUDE,
      }),
      this.prisma.quote.updateMany({
        where: { requestId: id, status: 'PENDING' },
        data: { status: 'REJECTED' },
      }),
    ]);

    if (providerIds.length > 0) {
      const providers = await this.prisma.provider.findMany({
        where: { id: { in: providerIds } },
        select: { userId: true },
      });
      const userIds = [
        ...new Set<string>(
          providers.flatMap((provider) =>
            typeof provider.userId === 'string' ? [provider.userId] : [],
          ),
        ),
      ];
      await Promise.all(
        userIds.map((userId) =>
          this.notifications.notify({
            userId,
            type: 'QUOTE_REJECTED',
            title: 'Request cancelled',
            body: `The client cancelled "${request.title}".`,
            data: { requestId: id },
          }),
        ),
      );
    }

    return updated;
  }

  // Opens or closes the competition on a direct (pinned) request. Client
  // only. Broadcast requests have no pinned provider to open against, and
  // requests that stopped accepting quotes are frozen as they are.
  async setPrivacy(id: string, clientUserId: string, isPublic: boolean) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    const request = await this.prisma.serviceRequest.findUnique({ where: { id } });
    if (!request || !clientProfile || request.clientId !== clientProfile.id) {
      throw new NotFoundException('Service request not found');
    }
    if (!request.providerId) {
      throw new BadRequestException('This request is already open to all matching providers');
    }
    if (!ACCEPTING_STATUSES.includes(request.status as AcceptingStatus)) {
      throw new BadRequestException('This request can no longer be changed');
    }
    return this.prisma.serviceRequest.update({ where: { id }, data: { isPublic }, include: REQUEST_INCLUDE });
  }

  // Who may view a request: its client, the pinned provider, a provider the
  // marketplace is currently open to (a matching service + accepting status),
  // or a provider who already has a quote on it (so closing the competition
  // never strands a provider mid-negotiation).
  private async assertParticipant(request: MarketRequestShape, userId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (clientProfile && request.clientId === clientProfile.id) return;

    const providerIds = await this.providerContext.getProviderIdsForUser(userId);
    if (providerIds.length === 0) throw new ForbiddenException('Not authorized to view this request');

    const active = this.workspaceContext?.getForUser(userId);
    if (active?.role === 'MEMBER' && request.assignedMembershipId !== active.membershipId) {
      throw new ForbiddenException('This request is not assigned to you');
    }

    if (request.providerId && providerIds.includes(request.providerId)) return;

    const hasQuote =
      (await this.prisma.quote.findFirst({
        where: { requestId: request.id, providerId: { in: providerIds } },
        select: { id: true },
      })) !== null;
    if (hasQuote) return;

    if (await this.providerHasMarketplaceAccess(request, providerIds)) return;

    throw new ForbiddenException('Not authorized to view this request');
  }

  // Can any of this user's providers see the request as a marketplace
  // participant? They must actually serve the requested service, and the
  // request must currently be public to it: a broadcast (providerId null)
  // while OPEN, or a client-opened direct request while it accepts quotes.
  private async providerHasMarketplaceAccess(
    request: MarketRequestShape,
    providerIds: string[],
  ): Promise<boolean> {
    const providers = await this.prisma.provider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, services: { select: { serviceId: true } } },
    });
    for (const provider of providers) {
      if (!provider.services.some((s) => s.serviceId === request.serviceId)) continue;
      if (request.isPublic && ACCEPTING_STATUSES.includes(request.status as AcceptingStatus)) return true;
      if (request.providerId === null && request.status === 'OPEN') return true;
    }
    return false;
  }
}
