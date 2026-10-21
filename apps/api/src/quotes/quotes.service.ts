import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InteractionService } from '../personalization/interactions/interaction.service';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_UPLOAD_BYTES, STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { sniffMime } from '../verification/file-sniffer';
import { ProviderContextService } from '../providers/provider-context.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ProposeRevisionDto } from './dto/propose-revision.dto';

export const QUOTE_ATTACHMENT_PREFIX = 'quote-attachments';

const QUOTE_INCLUDE = {
  revisions: { orderBy: { createdAt: 'asc' as const } },
  provider: { select: { id: true, businessName: true } },
  request: true,
  attachments: true,
};

// A request can still take (new) quotes or negotiation in these statuses.
const ACCEPTING_STATUSES = ['OPEN', 'QUOTED', 'NEGOTIATING'] as const;
type AcceptingStatus = (typeof ACCEPTING_STATUSES)[number];

@Injectable()
export class QuotesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private interactions: InteractionService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    private providerContext: ProviderContextService,
  ) {}

  // Quote attachments (reference photos, spec sheets) are namespaced per
  // provider, same pattern as verification documents and review photos —
  // create() below only accepts keys under the calling provider's own
  // prefix, and only ones the storage layer can actually see.
  async uploadAttachment(providerUserId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File is too large (max 8 MB)');
    const mime = sniffMime(file.buffer);
    if (!mime || !ALLOWED_DOCUMENT_MIME_TYPES.includes(mime)) {
      throw new BadRequestException('Only JPEG, PNG, WEBP images or PDF files are allowed');
    }
    const provider = await this.providerContext.resolveForUser(providerUserId);

    const result = await this.storage.upload(file.buffer, file.originalname, mime, `${QUOTE_ATTACHMENT_PREFIX}/${provider.id}`);
    return { storageKey: result.key, url: result.url, fileName: file.originalname.slice(0, 200), mimeType: mime };
  }

  async create(providerUserId: string, dto: CreateQuoteDto) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    const request = await this.prisma.serviceRequest.findUnique({ where: { id: dto.requestId } });
    if (!request) throw new NotFoundException('Service request not found');

    // Direct requests are private to the pinned provider — unless the client
    // opened them to the marketplace (isPublic), in which case any provider
    // of the service may compete. Broadcast requests (providerId null) are
    // the marketplace itself.
    if (request.providerId && request.providerId !== provider.id) {
      const canCompete =
        request.isPublic &&
        (await this.providerOffersService(provider.id, request.serviceId));
      if (!canCompete) {
        throw new ForbiddenException('This request was sent to a different provider');
      }
    } else if (request.providerId === null && !(await this.providerOffersService(provider.id, request.serviceId))) {
      throw new BadRequestException('You can only quote requests for a service you offer');
    }

    if (!ACCEPTING_STATUSES.includes(request.status as AcceptingStatus)) {
      throw new BadRequestException('This request is no longer accepting quotes');
    }
    if (dto.expiresAt && new Date(dto.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    const attachments = dto.attachments ?? [];
    const attachmentPrefix = `${QUOTE_ATTACHMENT_PREFIX}/${provider.id}/`;
    const seenKeys = new Set<string>();
    for (const a of attachments) {
      if (!a.storageKey.startsWith(attachmentPrefix) || a.storageKey.includes('..')) {
        throw new BadRequestException('Invalid attachment reference');
      }
      if (seenKeys.has(a.storageKey)) throw new BadRequestException('The same attachment was included twice');
      seenKeys.add(a.storageKey);
    }
    const stats = await Promise.all(attachments.map((a) => this.storage.statObject(a.storageKey)));
    if (stats.some((s) => !s)) throw new BadRequestException('One or more attachments were not found. Upload them again.');

    const quote = await this.prisma.quote.create({
      data: {
        requestId: dto.requestId,
        providerId: provider.id,
        price: dto.price,
        estimatedDuration: dto.estimatedDuration,
        proposedDate: dto.proposedDate ? new Date(dto.proposedDate) : undefined,
        description: dto.description,
        materials: dto.materials,
        includedItems: dto.includedItems ?? [],
        excludedItems: dto.excludedItems ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        attachments: {
          create: attachments.map((a) => ({
            storageKey: a.storageKey,
            url: this.storage.getUrl(a.storageKey),
            fileName: a.fileName,
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });

    // A broadcast request is claimed by whoever quotes it first (providerId
    // moves to them). A direct or client-opened request keeps its pinned
    // provider — a competing quote must never reassign the primary provider
    // or its client↔provider conversation.
    await this.prisma.serviceRequest.update({
      where: { id: dto.requestId },
      data: request.providerId === null ? { providerId: provider.id, status: 'QUOTED' } : { status: 'QUOTED' },
    });

    await this.notifications.notify({
      userId: await this.clientUserId(request.clientId),
      type: 'NEW_QUOTE',
      title: 'New quote received',
      body: `${provider.businessName} sent you a quote of ${dto.price} RWF`,
      data: { requestId: dto.requestId, quoteId: quote.id },
    });

    return quote;
  }

  // The client sees every quote on their request (that is the point of
  // competition). Providers never see each other's — quote amounts are
  // private between client and each provider — so a provider only ever
  // receives their own quotes back, and only for requests they are party to:
  // the pinned provider, a provider the marketplace is open to, or anyone
  // who already quoted (retained even after the client closes competition).
  async findForRequest(requestId: string, userId: string) {
    const request = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Service request not found');

    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    const isClient = !!clientProfile && request.clientId === clientProfile.id;
    if (isClient) {
      return this.prisma.quote.findMany({
        where: { requestId },
        include: QUOTE_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    }

    const providerIds = await this.providerContext.getProviderIdsForUser(userId);
    if (providerIds.length === 0) throw new ForbiddenException('Not authorized');

    const isPinned = !!request.providerId && providerIds.includes(request.providerId);
    const hasQuote =
      (await this.prisma.quote.findFirst({
        where: { requestId, providerId: { in: providerIds } },
        select: { id: true },
      })) !== null;
    const marketVisible = await this.marketVisibleTo(request, providerIds);
    if (!isPinned && !hasQuote && !marketVisible) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.quote.findMany({
      where: { requestId, providerId: { in: providerIds } },
      include: QUOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- Negotiation (spec §14): structured price proposals, not plain chat ---

  async proposeRevision(quoteId: string, userId: string, dto: ProposeRevisionDto) {
    const quote = await this.getQuoteOrThrow(quoteId);
    const { role } = await this.assertQuoteParticipant(quote, userId);

    if (!['PENDING'].includes(quote.status)) {
      throw new BadRequestException('This quote is no longer open for negotiation');
    }

    const revision = await this.prisma.quoteRevision.create({
      data: {
        quoteId,
        proposedBy: role,
        price: dto.price,
        message: dto.message,
      },
    });

    await this.prisma.serviceRequest.update({
      where: { id: quote.requestId },
      data: { status: 'NEGOTIATING' },
    });

    const recipientUserId = role === 'CLIENT' ? await this.providerUserId(quote.providerId) : await this.requestClientUserId(quote.requestId);
    await this.notifications.notify({
      userId: recipientUserId,
      type: 'QUOTE_UPDATED',
      title: 'New price proposal',
      body: `A new price of ${dto.price} RWF was proposed`,
      data: { quoteId, revisionId: revision.id },
    });

    return revision;
  }

  async respondToRevision(revisionId: string, userId: string, action: 'accept' | 'reject') {
    const revision = await this.prisma.quoteRevision.findUnique({
      where: { id: revisionId },
      include: { quote: true },
    });
    if (!revision) throw new NotFoundException('Revision not found');

    const { role } = await this.assertQuoteParticipant(revision.quote, userId);
    // You cannot accept/reject your own proposal — the other party responds.
    if (revision.proposedBy === role) {
      throw new ForbiddenException('Waiting on the other party to respond to this proposal');
    }
    if (revision.status !== 'PENDING') {
      throw new BadRequestException('This proposal has already been resolved');
    }

    if (action === 'reject') {
      return this.prisma.quoteRevision.update({ where: { id: revisionId }, data: { status: 'REJECTED' } });
    }

    // Accept: this revision's price becomes the quote's price; any other
    // pending revisions on the same quote are superseded.
    const [updatedRevision] = await this.prisma.$transaction([
      this.prisma.quoteRevision.update({ where: { id: revisionId }, data: { status: 'ACCEPTED' } }),
      this.prisma.quoteRevision.updateMany({
        where: { quoteId: revision.quoteId, id: { not: revisionId }, status: 'PENDING' },
        data: { status: 'SUPERSEDED' },
      }),
      this.prisma.quote.update({ where: { id: revision.quoteId }, data: { price: revision.price } }),
    ]);

    if (action === 'accept') {
      const proposerUserId =
        revision.proposedBy === 'CLIENT'
          ? await this.requestClientUserId(revision.quote.requestId)
          : await this.providerUserId(revision.quote.providerId);
      await this.notifications.notify({
        userId: proposerUserId,
        type: 'QUOTE_UPDATED',
        title: 'Your price proposal was accepted',
        body: `${Number(revision.price).toLocaleString()} RWF was accepted`,
        data: { quoteId: revision.quoteId },
      });
    }

    return updatedRevision;
  }

  // --- Accept / reject the quote itself (client only) ---

  async accept(quoteId: string, clientUserId: string) {
    const quote = await this.getQuoteOrThrow(quoteId);
    const clientProfile = await this.assertClientOwnsRequest(quote.requestId, clientUserId);

    if (quote.status !== 'PENDING') throw new BadRequestException('Quote is not pending');

    const booking = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } });
      await tx.quote.updateMany({
        where: { requestId: quote.requestId, id: { not: quoteId }, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });
      await tx.serviceRequest.update({ where: { id: quote.requestId }, data: { status: 'BOOKED' } });

      const created = await tx.booking.create({
        data: {
          serviceRequestId: quote.requestId,
          quoteId: quote.id,
          clientId: clientProfile.id,
          providerId: quote.providerId,
          status: 'ACCEPTED',
          agreedPrice: quote.price,
          currency: quote.currency,
        },
      });
      await tx.bookingStatusHistory.create({
        data: { bookingId: created.id, toStatus: 'ACCEPTED', note: 'Quote accepted by client' },
      });
      return created;
    });

    const provider = await this.prisma.provider.findUniqueOrThrow({
      where: { id: quote.providerId },
      select: { businessName: true },
    });
    await this.notifications.notify({
      userId: await this.providerUserId(quote.providerId),
      type: 'QUOTE_ACCEPTED',
      title: 'Your quote was accepted',
      body: `Your quote of ${formatRwf(quote.price)} was accepted. A booking has been created — open it to see the agreed details.`,
      data: { quoteId, bookingId: booking.id },
    });
    await this.notifications.notify({
      userId: await this.requestClientUserId(quote.requestId),
      type: 'BOOKING_CREATED',
      title: 'Booking confirmed',
      body: `Your booking with ${provider.businessName} has been created at the agreed price of ${formatRwf(quote.price)}.`,
      data: { bookingId: booking.id },
    });

    await this.interactions.record(clientUserId, 'ACCEPT_QUOTE', 'QUOTE', quoteId);
    await this.interactions.record(clientUserId, 'CREATE_BOOKING', 'BOOKING', booking.id);

    return booking;
  }

  async reject(quoteId: string, clientUserId: string) {
    const quote = await this.getQuoteOrThrow(quoteId);
    await this.assertClientOwnsRequest(quote.requestId, clientUserId);
    if (quote.status !== 'PENDING') throw new BadRequestException('Quote is not pending');
    const updated = await this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'REJECTED' } });

    await this.notifications.notify({
      userId: await this.providerUserId(quote.providerId),
      type: 'QUOTE_REJECTED',
      title: 'Your quote was declined',
      data: { quoteId },
    });

    return updated;
  }

  private async getQuoteOrThrow(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  private async providerOffersService(providerId: string, serviceId: string): Promise<boolean> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { services: { select: { serviceId: true } } },
    });
    return !!provider?.services.some((s) => s.serviceId === serviceId);
  }

  // Is the marketplace currently open to any of these providers on this
  // request? Mirrors ServiceRequestsService.assertParticipant: a broadcast
  // request (providerId null) while OPEN, or a client-opened direct request
  // (isPublic) while it accepts quotes, both for a matching service.
  private async marketVisibleTo(
    request: { providerId: string | null; serviceId: string; status: string; isPublic: boolean },
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

  private async assertQuoteParticipant(quote: { providerId: string; requestId: string }, userId: string) {
    if (await this.providerContext.userHasAccessToProvider(userId, quote.providerId)) {
      return { role: 'PROVIDER' as const };
    }

    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    const request = await this.prisma.serviceRequest.findUnique({ where: { id: quote.requestId } });
    if (clientProfile && request?.clientId === clientProfile.id) return { role: 'CLIENT' as const };

    throw new ForbiddenException('Not authorized for this quote');
  }

  private async providerUserId(providerId: string): Promise<string> {
    const provider = await this.prisma.provider.findUniqueOrThrow({ where: { id: providerId } });
    return provider.userId;
  }

  private async clientUserId(clientProfileId: string): Promise<string> {
    const client = await this.prisma.clientProfile.findUniqueOrThrow({ where: { id: clientProfileId } });
    return client.userId;
  }

  private async requestClientUserId(requestId: string): Promise<string> {
    const request = await this.prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestId } });
    return this.clientUserId(request.clientId);
  }

  private async assertClientOwnsRequest(requestId: string, clientUserId: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    const request = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!clientProfile || !request || request.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not authorized for this request');
    }
    return clientProfile;
  }
}

// A quote's price is a Prisma Decimal, so `toLocaleString` isn't available on
// it directly — this normalises it to a grouped numeric string for the
// notification copy ("25,000 RWF"). `2` decimals are dropped because prices
// are whole RWF amounts in practice and the extra `.00` only adds noise.
function formatRwf(value: Prisma.Decimal | number | string): string {
  return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
}
