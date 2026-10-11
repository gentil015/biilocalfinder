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
import { STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { ProviderContextService } from '../providers/provider-context.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { HideReviewDto, ListReviewsQueryDto, RespondToReviewDto } from './dto/review-moderation.dto';
import { assessReview, reviewDeadline, reviewerDisplayName } from './review-integrity';

export const REVIEW_PHOTO_PREFIX = 'review-photos';

type Db = Prisma.TransactionClient | PrismaService;

const PUBLIC_REVIEW_INCLUDE = {
  client: { select: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
  images: { orderBy: { position: 'asc' as const }, select: { id: true, url: true } },
} satisfies Prisma.ReviewInclude;

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditLog: AuditLogService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    private providerContext: ProviderContextService,
  ) {}

  // ---------------------------------------------------------------------
  // Creating a review
  // ---------------------------------------------------------------------

  async create(bookingId: string, clientUserId: string, dto: CreateReviewDto, now = new Date()) {
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientUserId },
      include: { user: { select: { createdAt: true, emailVerified: true, phoneVerified: true } } },
    });
    if (!clientProfile) throw new ForbiddenException('Only clients can leave reviews');

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.clientId !== clientProfile.id) {
      throw new ForbiddenException('Not authorized to review this booking');
    }
    // Prevents reviews before completion and random users reviewing
    // providers — only the client on a COMPLETED booking may review it.
    if (booking.status !== 'COMPLETED') {
      throw new BadRequestException('You can only review a completed booking');
    }

    const completedAt = booking.completedAt ?? booking.updatedAt;
    if (now.getTime() > reviewDeadline(completedAt).getTime()) {
      throw new BadRequestException('The review window for this booking has closed');
    }

    const existing = await this.prisma.review.findUnique({ where: { bookingId } });
    if (existing) throw new BadRequestException('This booking has already been reviewed');

    const photos = await this.validatePhotoKeys(dto.photoKeys ?? [], clientProfile.id);

    const assessment = assessReview({
      bookingCompleted: true,
      reviewerCreatedAt: clientProfile.user.createdAt,
      emailVerified: clientProfile.user.emailVerified,
      phoneVerified: clientProfile.user.phoneVerified,
      bookingCreatedAt: booking.createdAt,
      bookingCompletedAt: booking.completedAt,
      now,
    });

    let review;
    try {
      review = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.review.create({
          data: {
            bookingId,
            clientId: clientProfile.id,
            providerId: booking.providerId,
            rating: dto.rating,
            qualityRating: dto.qualityRating,
            communicationRating: dto.communicationRating,
            professionalismRating: dto.professionalismRating,
            valueRating: dto.valueRating,
            comment: dto.comment?.trim() || undefined,
            verifiedBooking: assessment.verifiedBooking,
            integrityFlags: assessment.flags,
            images: { create: photos.map((p, i) => ({ url: p.url, storageKey: p.storageKey, position: i })) },
          },
          include: PUBLIC_REVIEW_INCLUDE,
        });
        await this.recalculateProviderAggregates(tx, booking.providerId);
        return created;
      });
    } catch (err) {
      // Two simultaneous submissions: the unique bookingId constraint decides.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('This booking has already been reviewed');
      }
      throw err;
    }

    const provider = await this.prisma.provider.findUniqueOrThrow({ where: { id: booking.providerId } });
    await this.notifications.notify({
      userId: provider.userId,
      type: 'NEW_REVIEW',
      title: 'New review received',
      body: `${dto.rating}★${dto.comment ? ` — ${dto.comment.slice(0, 140)}` : ''}`,
      data: { reviewId: review.id, bookingId },
    });

    return this.toPublic(review);
  }

  // Review photos are public (they appear on the provider's page), so they
  // use the public bucket path — but namespaced per client, and only keys the
  // storage layer can actually see are accepted.
  async uploadPhoto(clientUserId: string, buffer: Buffer, originalName: string, mimeType: string) {
    const clientProfile = await this.prisma.clientProfile.findUnique({ where: { userId: clientUserId } });
    if (!clientProfile) throw new ForbiddenException('Only clients can upload review photos');
    const result = await this.storage.upload(buffer, originalName, mimeType, `${REVIEW_PHOTO_PREFIX}/${clientProfile.id}`);
    return { storageKey: result.key, url: result.url };
  }

  private async validatePhotoKeys(keys: string[], clientId: string) {
    const prefix = `${REVIEW_PHOTO_PREFIX}/${clientId}/`;
    const unique = Array.from(new Set(keys));
    for (const key of unique) {
      if (!key.startsWith(prefix) || key.includes('..')) throw new BadRequestException('Invalid photo reference');
    }
    const stats = await Promise.all(unique.map((k) => this.storage.statObject(k)));
    if (stats.some((s) => !s)) throw new BadRequestException('One or more photos were not found. Upload them again.');
    return unique.map((storageKey) => ({ storageKey, url: this.storage.getUrl(storageKey) }));
  }

  // Provider rating/reviewCount are recomputed from an aggregate instead of
  // an incremental running average — cheap at this scale and immune to drift
  // from concurrent writes. HIDDEN (moderated) reviews never count.
  async recalculateProviderAggregates(db: Db, providerId: string) {
    const where = { providerId, status: 'PUBLISHED' as const };
    const [agg, verifiedCount] = await Promise.all([
      db.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      db.review.count({ where: { ...where, verifiedBooking: true } }),
    ]);
    await db.provider.update({
      where: { id: providerId },
      data: {
        rating: agg._avg.rating != null ? Math.round(agg._avg.rating * 100) / 100 : 0,
        reviewCount: agg._count,
        verifiedReviewCount: verifiedCount,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Reading reviews
  // ---------------------------------------------------------------------

  // Public shape: never exposes the reviewer's identity beyond "Jean K.",
  // nor internal integrity flags.
  private toPublic(r: any) {
    return {
      id: r.id,
      rating: r.rating,
      qualityRating: r.qualityRating,
      communicationRating: r.communicationRating,
      professionalismRating: r.professionalismRating,
      valueRating: r.valueRating,
      comment: r.comment,
      verifiedBooking: r.verifiedBooking,
      createdAt: r.createdAt,
      reviewer: {
        name: reviewerDisplayName(r.client?.user?.firstName, r.client?.user?.lastName),
        avatarUrl: r.client?.user?.avatarUrl ?? null,
      },
      images: (r.images ?? []).map((i: { id: string; url: string }) => ({ id: i.id, url: i.url })),
      providerResponse: r.providerResponse
        ? { text: r.providerResponse, respondedAt: r.providerRespondedAt }
        : null,
    };
  }

  async findForProvider(providerId: string, query: ListReviewsQueryDto = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

    const where: Prisma.ReviewWhereInput = {
      providerId,
      status: 'PUBLISHED',
      ...(query.verifiedOnly === 'true' ? { verifiedBooking: true } : {}),
      ...(query.withPhotos === 'true' ? { images: { some: {} } } : {}),
    };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      query.sort === 'highest'
        ? [{ rating: 'desc' }, { createdAt: 'desc' }]
        : query.sort === 'lowest'
          ? [{ rating: 'asc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({ where, orderBy, include: PUBLIC_REVIEW_INCLUDE, skip: (page - 1) * limit, take: limit }),
      this.prisma.review.count({ where }),
    ]);
    return { items: items.map((r) => this.toPublic(r)), total, page, limit };
  }

  // Headline number + the breakdown behind it.
  async summaryForProvider(providerId: string) {
    const where = { providerId, status: 'PUBLISHED' as const };
    const [agg, dist, verifiedCount, photoCount] = await Promise.all([
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true, qualityRating: true, communicationRating: true, professionalismRating: true, valueRating: true },
        _count: true,
      }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      this.prisma.review.count({ where: { ...where, verifiedBooking: true } }),
      this.prisma.review.count({ where: { ...where, images: { some: {} } } }),
    ]);

    const round = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const row of dist as { rating: number; _count: { _all: number } }[]) distribution[String(row.rating)] = row._count._all;

    return {
      overall: round(agg._avg.rating),
      count: agg._count,
      verifiedCount,
      withPhotosCount: photoCount,
      breakdown: {
        quality: round(agg._avg.qualityRating),
        communication: round(agg._avg.communicationRating),
        professionalism: round(agg._avg.professionalismRating),
        value: round(agg._avg.valueRating),
      },
      distribution,
    };
  }

  // For the booking screen: is there a review, and may this person leave one?
  async forBooking(bookingId: string, userId: string, now = new Date()) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        client: { select: { userId: true } },
        provider: { select: { userId: true } },
        review: { include: PUBLIC_REVIEW_INCLUDE },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    const isClient = booking.client.userId === userId;
    const isProvider = booking.provider.userId === userId;
    if (!isClient && !isProvider) throw new ForbiddenException('Not a participant in this booking');

    const completedAt = booking.completedAt ?? booking.updatedAt;
    const deadline = reviewDeadline(completedAt);
    const canReview =
      isClient && booking.status === 'COMPLETED' && !booking.review && now.getTime() <= deadline.getTime();

    return {
      review: booking.review ? this.toPublic(booking.review) : null,
      canReview,
      reviewDeadline: booking.status === 'COMPLETED' ? deadline : null,
    };
  }

  // ---------------------------------------------------------------------
  // Provider response
  // ---------------------------------------------------------------------

  async respond(providerUserId: string, reviewId: string, dto: RespondToReviewDto, now = new Date()) {
    const provider = await this.providerContext.resolveForUser(providerUserId);

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { client: { select: { userId: true } } },
    });
    if (!review || review.providerId !== provider.id) throw new NotFoundException('Review not found');
    if (review.status !== 'PUBLISHED') throw new BadRequestException('This review is no longer public');

    const isFirst = !review.providerResponse;
    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: { providerResponse: dto.text.trim(), providerRespondedAt: now },
      include: PUBLIC_REVIEW_INCLUDE,
    });

    if (isFirst) {
      await this.notifications.notify({
        userId: review.client.userId,
        type: 'REVIEW_RESPONSE',
        title: `${provider.businessName} responded to your review`,
        body: dto.text.trim().slice(0, 140),
        data: { reviewId, providerId: provider.id },
      });
    }
    return this.toPublic(updated);
  }

  // Provider's own inbox of reviews (so they can find ones to answer).
  async findMineAsProvider(providerUserId: string, query: ListReviewsQueryDto = {}) {
    const provider = await this.providerContext.resolveForUser(providerUserId);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = 20;
    const where: Prisma.ReviewWhereInput = {
      providerId: provider.id,
      status: 'PUBLISHED',
      ...(query.unanswered === 'true' ? { providerResponse: null } : {}),
    };
    const [items, total, unanswered] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: PUBLIC_REVIEW_INCLUDE,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.count({ where: { providerId: provider.id, status: 'PUBLISHED', providerResponse: null } }),
    ]);
    return { items: items.map((r) => this.toPublic(r)), total, unanswered, page, limit };
  }

  // ---------------------------------------------------------------------
  // Admin moderation
  // ---------------------------------------------------------------------

  // Published reviews carrying at least one integrity flag, or lacking the
  // strong verified signal — the ones worth a human look.
  async findFlagged(page = 1) {
    const limit = 20;
    const where: Prisma.ReviewWhereInput = {
      status: 'PUBLISHED',
      OR: [{ integrityFlags: { isEmpty: false } }, { verifiedBooking: false }],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { select: { id: true, url: true } },
          client: { select: { user: { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } } } },
          provider: { select: { id: true, businessName: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async hide(reviewId: string, adminId: string, dto: HideReviewDto, now = new Date()) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'HIDDEN') return review;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.review.update({
        where: { id: reviewId },
        data: { status: 'HIDDEN', hiddenReason: dto.reason, hiddenAt: now, hiddenById: adminId },
      });
      await this.recalculateProviderAggregates(tx, review.providerId);
      return r;
    });
    await this.auditLog.log(adminId, 'REVIEW_HIDDEN', 'Review', reviewId, { providerId: review.providerId, reason: dto.reason });
    return updated;
  }

  async restore(reviewId: string, adminId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.status === 'PUBLISHED') return review;

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await tx.review.update({
        where: { id: reviewId },
        data: { status: 'PUBLISHED', hiddenReason: null, hiddenAt: null, hiddenById: null },
      });
      await this.recalculateProviderAggregates(tx, review.providerId);
      return r;
    });
    await this.auditLog.log(adminId, 'REVIEW_RESTORED', 'Review', reviewId, { providerId: review.providerId });
    return updated;
  }
}
