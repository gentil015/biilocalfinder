import { ReportsService } from './reports.service';

describe('ReportsService lifecycle', () => {
  let service: ReportsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      report: {
        count: jest.fn(),
        create: jest.fn((args) => args.data),
        findMany: jest.fn(),
      },
      provider: { findUnique: jest.fn().mockResolvedValue({ id: 'provider-1' }) },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ReportsService(prisma, audit);
  });

  it('only treats OPEN and UNDER_REVIEW reports as blocking a new report', async () => {
    prisma.report.count.mockResolvedValue(0);

    await service.create('reporter-1', {
      targetType: 'PROVIDER' as any,
      targetId: 'provider-1',
      category: 'OTHER' as any,
      reason: 'Suspicious listing',
    });

    expect(prisma.report.count).toHaveBeenCalledWith({
      where: {
        reporterId: 'reporter-1',
        targetType: 'PROVIDER',
        targetId: 'provider-1',
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    });
  });

  it('counts only active reports for a target', async () => {
    prisma.report.count.mockResolvedValue(3);

    await expect(service.openCountByTarget('PROVIDER' as any, 'provider-1')).resolves.toBe(3);
    expect(prisma.report.count).toHaveBeenCalledWith({
      where: { targetType: 'PROVIDER', targetId: 'provider-1', status: { in: ['OPEN', 'UNDER_REVIEW'] } },
    });
  });

  it('returns a reporter their own report history', async () => {
    prisma.report.findMany.mockResolvedValue([]);

    await service.findMine('reporter-1');

    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: { reporterId: 'reporter-1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
});
