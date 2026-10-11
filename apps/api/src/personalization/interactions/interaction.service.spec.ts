import { InteractionService } from './interaction.service';

describe('InteractionService', () => {
  let service: InteractionService;
  let prisma: any;
  let queue: any;

  beforeEach(() => {
    prisma = {
      userInteraction: { create: jest.fn().mockResolvedValue({}) },
      userInterest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      service: { findFirst: jest.fn(), findUnique: jest.fn() },
      serviceCategory: { findFirst: jest.fn() },
      serviceOffering: { findMany: jest.fn(), findUnique: jest.fn() },
      serviceRequest: { findUnique: jest.fn() },
      booking: { findUnique: jest.fn() },
      quote: { findUnique: jest.fn() },
    };
    queue = { add: jest.fn() };
    service = new InteractionService(prisma, queue);
  });

  it('always records the raw interaction row, even with no resolvable entity', async () => {
    await service.record('user-1', 'SEARCH', undefined, undefined, { query: 'nonexistent thing' });
    expect(prisma.userInteraction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', type: 'SEARCH' }) }),
    );
  });

  it('creates a new UserInterest row with the correct weight on first interaction', async () => {
    prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', categoryId: 'cat-1' });

    await service.record('user-1', 'VIEW_SERVICE', 'SERVICE', 'svc-1');

    expect(prisma.userInterest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', categoryId: 'cat-1', serviceId: 'svc-1', score: 2 }),
      }),
    );
  });

  it('resolves interest via the specific ServiceOffering when a view is scoped to one provider', async () => {
    prisma.serviceOffering.findUnique.mockResolvedValue({
      id: 'offering-1',
      service: { id: 'svc-1', categoryId: 'cat-1' },
    });

    await service.record('user-1', 'VIEW_SERVICE', 'SERVICE_OFFERING', 'offering-1');

    expect(prisma.userInterest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', categoryId: 'cat-1', serviceId: 'svc-1', score: 2 }),
      }),
    );
  });

  it('accumulates score on repeated interactions rather than overwriting it', async () => {
    prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', categoryId: 'cat-1' });
    prisma.userInterest.findFirst.mockResolvedValue({ id: 'interest-1', score: 5 });

    await service.record('user-1', 'VIEW_SERVICE', 'SERVICE', 'svc-1');

    expect(prisma.userInterest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 7 }) }), // 5 existing + 2 weight
    );
  });

  it('applies a negative weight when a provider is unfavorited', async () => {
    prisma.serviceOffering.findMany.mockResolvedValue([
      { providerId: 'p1', serviceId: 'svc-1', service: { id: 'svc-1', categoryId: 'cat-1' } },
    ]);
    prisma.userInterest.findFirst.mockResolvedValue({ id: 'interest-1', score: 10 });

    await service.record('user-1', 'UNFAVORITE_PROVIDER', 'PROVIDER', 'p1');

    expect(prisma.userInterest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ score: 6 }) }), // 10 + (-4)
    );
  });

  it('enqueues a cache-invalidation job for a heavy interaction (booking completed)', async () => {
    prisma.booking.findUnique.mockResolvedValue({ serviceRequest: { serviceId: 'svc-1' } });
    prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', categoryId: 'cat-1' });

    await service.record('user-1', 'COMPLETE_BOOKING', 'BOOKING', 'booking-1');

    expect(queue.add).toHaveBeenCalledWith('invalidate-cache', { userId: 'user-1' }, expect.anything());
  });

  it('does not enqueue a cache-invalidation job for a lightweight interaction (a view)', async () => {
    prisma.service.findUnique.mockResolvedValue({ id: 'svc-1', categoryId: 'cat-1' });

    await service.record('user-1', 'VIEW_SERVICE', 'SERVICE', 'svc-1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('never throws — a personalization failure must not break the calling business action', async () => {
    prisma.userInteraction.create.mockRejectedValue(new Error('db down'));
    await expect(service.record('user-1', 'SEARCH')).resolves.toBeUndefined();
  });
});
