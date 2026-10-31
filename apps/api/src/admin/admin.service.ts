import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // --- Dashboard analytics (spec §32) ---

  async dashboard() {
    const [
      totalUsers,
      totalProviders,
      verifiedProviders,
      activeSubscriptions,
      activeBookings,
      completedBookings,
      newServiceRequests,
      openReports,
      openDisputes,
      pendingProviderApplications,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.provider.count(),
      this.prisma.provider.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.providerSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.booking.count({ where: { status: { in: ['ACCEPTED', 'CONFIRMED', 'IN_PROGRESS'] } } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.serviceRequest.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'RESPONDED', 'UNDER_REVIEW'] } } }),
      this.prisma.providerApplication.count({ where: { status: 'PENDING' } }),
    ]);

    return {
      totalUsers,
      totalProviders,
      verifiedProviders,
      activeSubscriptions,
      activeBookings,
      completedBookings,
      newServiceRequestsLast7Days: newServiceRequests,
      openReports,
      openDisputes,
      pendingProviderApplications,
    };
  }

  // --- User management (spec §24) ---

  async listUsers(query: ListUsersQueryDto) {
    const page = Number(query.page) || 1;
    const limit = 20;
    const searchTerms = query.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    const where = {
      role: query.role,
      status: query.status,
      ...(searchTerms.length
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { firstName: { contains: term, mode: 'insensitive' as const } },
                { lastName: { contains: term, mode: 'insensitive' as const } },
                { email: { contains: term, mode: 'insensitive' as const } },
                { phone: { contains: term, mode: 'insensitive' as const } },
              ],
            })),
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async setUserStatus(adminUserId: string, targetUserId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Cannot change the status of an admin account');

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await this.auditLog.log(
      adminUserId,
      status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      'User',
      targetUserId,
    );

    return updated;
  }

  async auditLogs(query: ListAuditLogsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 50;
    const search = query.search?.trim();
    const where = {
      action: query.action || undefined,
      entity: query.entity || undefined,
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' as const } },
              { entity: { contains: search, mode: 'insensitive' as const } },
              { entityId: { contains: search, mode: 'insensitive' as const } },
              {
                actor: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' as const } },
                      { lastName: { contains: search, mode: 'insensitive' as const } },
                      { email: { contains: search, mode: 'insensitive' as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          metadata: true,
          createdAt: true,
          actor: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async listSubscriptions(query: ListSubscriptionsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = 20;
    const searchTerms = query.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    const billingIssueRows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT ps."id"
      FROM "provider_subscriptions" ps
      WHERE ps."status" = 'PAST_DUE'
        OR (
          SELECT st."paymentStatus"
          FROM "subscription_transactions" st
          WHERE st."subscriptionId" = ps."id"
          ORDER BY st."createdAt" DESC, st."id" DESC
          LIMIT 1
        ) = 'FAILED'
    `;
    const where: Prisma.ProviderSubscriptionWhereInput = {
      status: query.status,
      ...(query.providerType ? { provider: { is: { providerType: query.providerType } } } : {}),
      ...(query.billingIssues === 'true' ? { id: { in: billingIssueRows.map(({ id }) => id) } } : {}),
      ...(searchTerms.length
        ? {
            AND: searchTerms.map((term) => ({
              OR: [
                { provider: { is: { businessName: { contains: term, mode: 'insensitive' } } } },
                {
                  provider: {
                    is: {
                      user: {
                        is: {
                          OR: [
                            { firstName: { contains: term, mode: 'insensitive' } },
                            { lastName: { contains: term, mode: 'insensitive' } },
                            { email: { contains: term, mode: 'insensitive' } },
                          ],
                        },
                      },
                    },
                  },
                },
                { plan: { is: { name: { contains: term, mode: 'insensitive' } } } },
              ],
            })),
          }
        : {}),
    };

    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [items, total, active, pastDue, expiringSoon] = await this.prisma.$transaction([
      this.prisma.providerSubscription.findMany({
        where,
        select: {
          id: true,
          status: true,
          startDate: true,
          renewalDate: true,
          endDate: true,
          createdAt: true,
          provider: {
            select: {
              id: true,
              businessName: true,
              providerType: true,
              subscriptionStatus: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              workspaceType: true,
              price: true,
              currency: true,
              billingInterval: true,
            },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              amount: true,
              currency: true,
              paymentProvider: true,
              paymentStatus: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ renewalDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.providerSubscription.count({ where }),
      this.prisma.providerSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.providerSubscription.count({ where: { status: 'PAST_DUE' } }),
      this.prisma.providerSubscription.count({
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
          renewalDate: { gte: now, lte: inThirtyDays },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      stats: { active, pastDue, expiringSoon, billingIssues: billingIssueRows.length },
    };
  }
}
