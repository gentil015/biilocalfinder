import { ForbiddenException } from '@nestjs/common';
import { ProviderAnalyticsService } from './provider-analytics.service';

describe('ProviderAnalyticsService', () => {
  let service: ProviderAnalyticsService;
  let prisma: any;
  let providerContext: any;

  const provider = {
    id: 'provider-1',
    services: [
      { id: 'offering-1', service: { id: 'svc-1', name: 'Wedding Photography' } },
      { id: 'offering-2', service: { id: 'svc-2', name: 'Portrait Photography' } },
    ],
  };

  beforeEach(() => {
    prisma = {
      provider: { findUniqueOrThrow: jest.fn().mockResolvedValue(provider) },
      userInteraction: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      serviceRequest: { count: jest.fn().mockResolvedValue(0) },
      quote: { count: jest.fn().mockResolvedValue(0) },
      booking: { count: jest.fn().mockResolvedValue(0) },
    };
    // ProviderContextService is what resolves the provider now that
    // Provider.userId isn't @unique; these specs only care about the
    // analytics computed off the result, so it just echoes the fixture id.
    providerContext = { resolveForUser: jest.fn().mockResolvedValue({ id: provider.id }) };
    service = new ProviderAnalyticsService(prisma, providerContext);
  });

  it('throws when the user has no provider profile', async () => {
    providerContext.resolveForUser.mockRejectedValue(new Error('Provider profile not found'));
    await expect(service.getMonthlySummary('user-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('computes conversion as bookings / requests, rounded to a whole percent', async () => {
    prisma.serviceRequest.count.mockResolvedValue(37);
    prisma.booking.count.mockResolvedValue(14);

    const summary = await service.getMonthlySummary('user-1');

    expect(summary.requests).toBe(37);
    expect(summary.bookings).toBe(14);
    expect(summary.conversionRate).toBe(38); // 14/37 = 37.8% -> rounds to 38
  });

  it('reports 0% conversion rather than dividing by zero when there are no requests yet', async () => {
    prisma.serviceRequest.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(0);

    const summary = await service.getMonthlySummary('user-1');

    expect(summary.conversionRate).toBe(0);
  });

  it('picks the most-viewed of the provider\'s own service offerings by raw view count', async () => {
    prisma.userInteraction.count.mockResolvedValue(0); // profile views
    prisma.userInteraction.findMany.mockResolvedValueOnce([
      { entityId: 'offering-1' },
      { entityId: 'offering-1' },
      { entityId: 'offering-2' },
    ]); // VIEW_SERVICE rows (first findMany call)

    const summary = await service.getMonthlySummary('user-1');

    expect(summary.serviceViews).toBe(3);
    expect(summary.mostViewedService).toEqual({
      serviceOfferingId: 'offering-1',
      serviceName: 'Wedding Photography',
      count: 2,
    });
  });

  it('matches SEARCH queries against the provider\'s own service names (rule-based, no NLP)', async () => {
    prisma.userInteraction.findMany
      .mockResolvedValueOnce([]) // VIEW_SERVICE rows
      .mockResolvedValueOnce([
        { metadata: { query: 'wedding photography kigali' } },
        { metadata: { query: 'wedding photography' } },
        { metadata: { query: 'plumber' } }, // doesn't match either service — ignored
      ]); // SEARCH rows

    const summary = await service.getMonthlySummary('user-1');

    expect(summary.topSearchedService).toEqual({
      serviceId: 'svc-1',
      serviceName: 'Wedding Photography',
      count: 2,
    });
  });

  it('returns null for top-searched/most-viewed service when there is no matching data', async () => {
    const summary = await service.getMonthlySummary('user-1');
    expect(summary.topSearchedService).toBeNull();
    expect(summary.mostViewedService).toBeNull();
  });
});
