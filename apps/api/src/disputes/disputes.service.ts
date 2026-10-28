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
import { AuditLogService } from '../common/services/audit-log.service';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_UPLOAD_BYTES, STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { sniffMime } from '../verification/file-sniffer';
import { canTransition, isOpenForActivity } from './dispute-status';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-message.dto';
import { AddDisputeEvidenceDto } from './dto/add-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

export const DISPUTE_EVIDENCE_PREFIX = 'dispute-evidence';
const SIGNED_URL_TTL_SECONDS = 300;

const DETAIL_INCLUDE = {
  raisedBy: { select: { id: true, firstName: true, lastName: true } },
  respondent: { select: { id: true, firstName: true, lastName: true } },
  resolvedBy: { select: { id: true, firstName: true, lastName: true } },
  booking: { select: { id: true, status: true, scheduledAt: true } },
  messages: { orderBy: { createdAt: 'asc' as const }, include: { author: { select: { id: true, firstName: true, lastName: true } } } },
  evidence: true,
} satisfies Prisma.DisputeInclude;

@Injectable()
export class DisputesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditLog: AuditLogService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  private async assertParticipant(disputeId: string, userId: string, allowAdmin: boolean, isAdmin: boolean) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const isParticipant = dispute.raisedById === userId || dispute.respondentId === userId;
    if (!isParticipant && !(allowAdmin && isAdmin)) throw new ForbiddenException('Not part of this dispute');
    return dispute;
  }

  // ---------------------------------------------------------------------
  // Client/provider: raise, view, respond, attach evidence
  // ---------------------------------------------------------------------

  async create(raisedById: string, dto: CreateDisputeDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      include: { client: { select: { userId: true } }, provider: { select: { userId: true, businessName: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const isClient = booking.client.userId === raisedById;
    const isProvider = booking.provider.userId === raisedById;
    if (!isClient && !isProvider) throw new ForbiddenException('Not a participant in this booking');

    const respondentId = isClient ? booking.provider.userId : booking.client.userId;

    const existing = await this.prisma.dispute.findFirst({
      where: { bookingId: dto.bookingId, status: { notIn: ['RESOLVED', 'REJECTED'] } },
    });
    if (existing) throw new BadRequestException('There is already an open dispute for this booking');

    const dispute = await this.prisma.dispute.create({
      data: {
        bookingId: dto.bookingId,
        raisedById,
        respondentId,
        category: dto.category,
        reason: dto.reason,
        details: dto.details,
      },
    });

    await this.notifications.notify({
      userId: respondentId,
      type: 'DISPUTE_OPENED',
      title: 'A dispute was opened about a booking',
      body: dto.reason,
      data: { disputeId: dispute.id, bookingId: dto.bookingId },
    });

    return dispute;
  }

  async findMine(userId: string) {
    return this.prisma.dispute.findMany({
      where: { OR: [{ raisedById: userId }, { respondentId: userId }] },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        respondent: { select: { id: true, firstName: true, lastName: true } },
        booking: { select: { id: true, status: true, scheduledAt: true } },
        _count: { select: { messages: true, evidence: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, isAdmin: boolean) {
    await this.assertParticipant(id, userId, true, isAdmin);
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const evidenceWithUrls = await Promise.all(
      dispute.evidence.map(async (e) => ({ ...e, url: await this.storage.getSignedUrl(e.storageKey, SIGNED_URL_TTL_SECONDS) })),
    );
    if (isAdmin && evidenceWithUrls.length > 0) {
      await this.auditLog.log(userId, 'DISPUTE_EVIDENCE_VIEWED', 'Dispute', id, {
        evidenceCount: evidenceWithUrls.length,
      });
    }
    return { ...dispute, evidence: evidenceWithUrls, evidenceLinksExpireInSeconds: SIGNED_URL_TTL_SECONDS };
  }

  // A message from the respondent, while the dispute is still OPEN, is the
  // "Provider response" step — advance the status automatically rather
  // than making either side toggle it themselves.
  async addMessage(id: string, userId: string, isAdmin: boolean, dto: AddDisputeMessageDto) {
    const dispute = await this.assertParticipant(id, userId, true, isAdmin);
    if (!isOpenForActivity(dispute.status)) throw new BadRequestException('This dispute is closed');

    const message = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.disputeMessage.create({
        data: { disputeId: id, authorId: userId, body: dto.body },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (dispute.status === 'OPEN' && userId === dispute.respondentId) {
        await tx.dispute.update({ where: { id }, data: { status: 'RESPONDED', respondedAt: new Date() } });
      }
      return created;
    });

    const recipients = [dispute.raisedById, dispute.respondentId].filter((uid) => uid !== userId);
    await Promise.all(
      recipients.map((uid) =>
        this.notifications.notify({
          userId: uid,
          type: 'DISPUTE_RESPONSE',
          title: 'New message on your dispute',
          body: dto.body.slice(0, 140),
          data: { disputeId: id },
        }),
      ),
    );

    return message;
  }

  async addEvidence(id: string, userId: string, isAdmin: boolean, file: Express.Multer.File | undefined, dto: AddDisputeEvidenceDto) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File is too large (max 8 MB)');
    const mime = sniffMime(file.buffer);
    if (!mime || !ALLOWED_DOCUMENT_MIME_TYPES.includes(mime)) {
      throw new BadRequestException('Only JPEG, PNG, WEBP images or PDF files are allowed');
    }

    const dispute = await this.assertParticipant(id, userId, true, isAdmin);
    if (!isOpenForActivity(dispute.status)) throw new BadRequestException('This dispute is closed');

    const { key } = await this.storage.uploadPrivate(file.buffer, file.originalname, mime, `${DISPUTE_EVIDENCE_PREFIX}/${id}`);
    return this.prisma.disputeEvidence.create({
      data: {
        disputeId: id,
        uploaderId: userId,
        storageKey: key,
        mimeType: mime,
        sizeBytes: file.size,
        description: dto.description,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Admin: review queue and resolution
  // ---------------------------------------------------------------------

  async findAllForAdmin(status?: string, page = 1) {
    const limit = 20;
    const where: Prisma.DisputeWhereInput = status ? { status: status as Prisma.EnumDisputeStatusFilter['equals'] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        include: {
          raisedBy: { select: { id: true, firstName: true, lastName: true } },
          respondent: { select: { id: true, firstName: true, lastName: true } },
          booking: { select: { id: true, status: true } },
          _count: { select: { messages: true, evidence: true } },
        },
        orderBy: { createdAt: 'asc' }, // oldest first — same "work the queue in order" convention as verification
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async review(id: string, adminId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!canTransition(dispute.status, 'UNDER_REVIEW')) {
      throw new BadRequestException(`A ${dispute.status.toLowerCase()} dispute cannot be moved to under review`);
    }

    const updated = await this.prisma.dispute.update({ where: { id }, data: { status: 'UNDER_REVIEW' } });
    await this.auditLog.log(adminId, 'DISPUTE_UNDER_REVIEW', 'Dispute', id, {});
    await Promise.all(
      [dispute.raisedById, dispute.respondentId].map((uid) =>
        this.notifications.notify({
          userId: uid,
          type: 'DISPUTE_UNDER_REVIEW',
          title: 'Your dispute is now under review',
          body: 'An admin is reviewing the messages and evidence submitted so far.',
          data: { disputeId: id },
        }),
      ),
    );
    return updated;
  }

  async resolve(id: string, adminId: string, dto: ResolveDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!canTransition(dispute.status, dto.outcome)) {
      throw new BadRequestException(`A ${dispute.status.toLowerCase()} dispute cannot be ${dto.outcome.toLowerCase()}`);
    }

    const now = new Date();
    const updated = await this.prisma.dispute.update({
      where: { id },
      data: {
        status: dto.outcome,
        resolutionType: dto.resolutionType,
        resolution: dto.resolution,
        resolvedById: adminId,
        resolvedAt: now,
      },
    });
    await this.auditLog.log(adminId, 'DISPUTE_RESOLVED', 'Dispute', id, { outcome: dto.outcome, resolutionType: dto.resolutionType });
    await Promise.all(
      [dispute.raisedById, dispute.respondentId].map((uid) =>
        this.notifications.notify({
          userId: uid,
          type: 'DISPUTE_RESOLVED',
          title: dto.outcome === 'RESOLVED' ? 'Your dispute has been resolved' : 'Your dispute was reviewed and closed',
          body: dto.resolution,
          data: { disputeId: id, outcome: dto.outcome, resolutionType: dto.resolutionType },
        }),
      ),
    );
    return updated;
  }
}
