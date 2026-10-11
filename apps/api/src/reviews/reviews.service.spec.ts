import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: any;
  let notifications: any;
  let auditLog: any;
  let storage: any;

  const verifiedClient = {
    id: 'client-1',
    user: { createdAt: new Date('2020-01-01'), emailVerified: true, phoneVerified: true },
  };

  beforeEach(() => {
    prisma = {
      clientProfile: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
      review: { findUnique: jest.fn() },
      provider: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };
    notifications = { notify: jest.fn() };
    auditLog = { log: jest.fn() };
    storage = { statObject: jest.fn(), getUrl: jest.fn() };
    service = new ReviewsService(prisma, notifications, auditLog, storage, { resolveForUser: jest.fn() } as any);
  });

  it("rejects a review for someone else's booking", async () => {
    prisma.clientProfile.findUnique.mockResolvedValue(verifiedClient);
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientId: 'someone-else', status: 'COMPLETED' });

    await expect(service.create('b1', 'user-1', { rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a review before the booking is completed', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue(verifiedClient);
    prisma.booking.findUnique.mockResolvedValue({ id: 'b1', clientId: 'client-1', status: 'IN_PROGRESS' });

    await expect(service.create('b1', 'user-1', { rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second review for the same booking', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue(verifiedClient);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      clientId: 'client-1',
      status: 'COMPLETED',
      completedAt: new Date(),
      createdAt: new Date(),
    });
    prisma.review.findUnique.mockResolvedValue({ id: 'existing-review' });

    await expect(service.create('b1', 'user-1', { rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a review submitted after the review window has closed', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue(verifiedClient);
    const longAgo = new Date('2020-01-01');
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      clientId: 'client-1',
      status: 'COMPLETED',
      completedAt: longAgo,
      createdAt: longAgo,
    });

    await expect(service.create('b1', 'user-1', { rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks a review from a verified-contact client on a completed booking as a verified booking', async () => {
    const now = new Date();
    prisma.clientProfile.findUnique.mockResolvedValue(verifiedClient);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'b1',
      clientId: 'client-1',
      providerId: 'provider-1',
      status: 'COMPLETED',
      completedAt: now,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    });
    prisma.review.findUnique.mockResolvedValue(null);
    prisma.provider.findUniqueOrThrow.mockResolvedValue({ userId: 'provider-user-1' });

    let createdData: any;
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        review: {
          create: jest.fn((args: any) => {
            createdData = args.data;
            return { ...args.data, id: 'review-1', client: { user: {} }, images: [] };
          }),
          aggregate: jest.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: 1 }),
          count: jest.fn().mockResolvedValue(1),
        },
        provider: { update: jest.fn() },
      };
      return fn(tx);
    });

    const result = await service.create('b1', 'user-1', { rating: 5 }, now);

    expect(createdData.verifiedBooking).toBe(true);
    expect(result.verifiedBooking).toBe(true);
  });
});
