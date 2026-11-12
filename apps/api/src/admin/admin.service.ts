import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { VerificationService } from '../verification/verification.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { BusinessAnalyticsQueryDto } from './dto/business-analytics-query.dto';
import { AdminUpdateProviderDto } from './dto/admin-update-provider.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private verification: VerificationService,
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

  async businessAnalytics(query: BusinessAnalyticsQueryDto) {
    const days = Number(query.days) || 30;
    const now = new Date();
    const periodStart = new Date(now.getTime() - days * DAY_MS);
    const previousStart = new Date(periodStart.getTime() - days * DAY_MS);

    const [
      registeredProviders,
      activeProviders,
      availableProviders,
      newProviders,
      newProvidersPrevious,
      totalRequests,
      requestsInPeriod,
      requestsPrevious,
      bookingsInPeriod,
      bookingsPrevious,
      successfulConnections,
      successfulConnectionsPrevious,
      cancelledInPeriod,
      reportsInPeriod,
      reportsPrevious,
      disputesInPeriod,
      disputesPrevious,
      openReports,
      openDisputes,
      totalReports,
      totalDisputes,
      totalUsers,
      newUsers,
      newUsersPrevious,
      deactivatedUsers,
      suspendedUsers,
    ] = await this.prisma.$transaction([
      this.prisma.provider.count(),
      this.prisma.provider.count({
        where: {
          user: { is: { status: 'ACTIVE' } },
          verificationStatus: { not: 'SUSPENDED' },
        },
      }),
      this.prisma.provider.count({
        where: {
          user: { is: { status: 'ACTIVE' } },
          availabilityStatus: 'AVAILABLE',
          verificationStatus: { not: 'SUSPENDED' },
        },
      }),
      this.prisma.provider.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.provider.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
      this.prisma.serviceRequest.count(),
      this.prisma.serviceRequest.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.serviceRequest.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
      this.prisma.booking.count({ where: { status: 'COMPLETED', completedAt: { gte: periodStart } } }),
      this.prisma.booking.count({
        where: { status: 'COMPLETED', completedAt: { gte: previousStart, lt: periodStart } },
      }),
      this.prisma.booking.count({ where: { status: 'CANCELLED', cancelledAt: { gte: periodStart } } }),
      this.prisma.report.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.report.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
      this.prisma.dispute.count({ where: { createdAt: { gte: periodStart } } }),
      this.prisma.dispute.count({ where: { createdAt: { gte: previousStart, lt: periodStart } } }),
      this.prisma.report.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'RESPONDED', 'UNDER_REVIEW'] } } }),
      this.prisma.report.count(),
      this.prisma.dispute.count(),
      this.prisma.user.count({ where: { role: { not: 'ADMIN' } } }),
      this.prisma.user.count({ where: { role: { not: 'ADMIN' }, createdAt: { gte: periodStart } } }),
      this.prisma.user.count({
        where: { role: { not: 'ADMIN' }, createdAt: { gte: previousStart, lt: periodStart } },
      }),
      this.prisma.user.count({ where: { role: { not: 'ADMIN' }, status: 'DEACTIVATED' } }),
      this.prisma.user.count({ where: { role: { not: 'ADMIN' }, status: 'SUSPENDED' } }),
    ]);

    const [activeUserRows, activeUserPreviousRows, inactiveUserRows, churnedUserRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT rt."userId")::int AS count
        FROM "refresh_tokens" rt
        JOIN "users" u ON u."id" = rt."userId"
        WHERE rt."createdAt" >= ${periodStart}
          AND u."role"::text <> 'ADMIN'
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT rt."userId")::int AS count
        FROM "refresh_tokens" rt
        JOIN "users" u ON u."id" = rt."userId"
        WHERE rt."createdAt" >= ${previousStart}
          AND rt."createdAt" < ${periodStart}
          AND u."role"::text <> 'ADMIN'
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "users" u
        WHERE u."createdAt" < ${periodStart}
          AND u."role"::text <> 'ADMIN'
          AND NOT EXISTS (
            SELECT 1
            FROM "refresh_tokens" rt
            WHERE rt."userId" = u."id"
              AND rt."createdAt" >= ${periodStart}
          )
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT DISTINCT rt."userId"
          FROM "refresh_tokens" rt
          JOIN "users" u ON u."id" = rt."userId"
          WHERE rt."createdAt" >= ${previousStart}
            AND rt."createdAt" < ${periodStart}
            AND u."role"::text <> 'ADMIN'
          EXCEPT
          SELECT DISTINCT rt."userId"
          FROM "refresh_tokens" rt
          JOIN "users" u ON u."id" = rt."userId"
          WHERE rt."createdAt" >= ${periodStart}
            AND u."role"::text <> 'ADMIN'
        ) churned
      `,
    ]);

    const activeUsers = Number(activeUserRows[0]?.count ?? 0);
    const activeUsersPrevious = Number(activeUserPreviousRows[0]?.count ?? 0);
    const inactiveUsers = Number(inactiveUserRows[0]?.count ?? 0);
    const churnedUsers = Number(churnedUserRows[0]?.count ?? 0);
    const complaintsInPeriod = reportsInPeriod + disputesInPeriod;
    const complaintsPrevious = reportsPrevious + disputesPrevious;
    const openComplaints = openReports + openDisputes;

    return {
      periodDays: days,
      periodLabel: `Last ${days} days`,
      periodStart: periodStart.toISOString(),
      generatedAt: now.toISOString(),
      providers: {
        registered: registeredProviders,
        active: activeProviders,
        availableNow: availableProviders,
        newInPeriod: newProviders,
        newInPreviousPeriod: newProvidersPrevious,
        activeRate: rate(activeProviders, registeredProviders),
        newChange: percentageChange(newProviders, newProvidersPrevious),
      },
      bookings: {
        totalRequests,
        requestsInPeriod,
        requestsInPreviousPeriod: requestsPrevious,
        bookingsInPeriod,
        bookingsInPreviousPeriod: bookingsPrevious,
        successfulConnections,
        successfulConnectionsInPreviousPeriod: successfulConnectionsPrevious,
        cancelledInPeriod,
        connectionRate: rate(successfulConnections, requestsInPeriod),
        requestsChange: percentageChange(requestsInPeriod, requestsPrevious),
        connectionsChange: percentageChange(successfulConnections, successfulConnectionsPrevious),
      },
      complaints: {
        total: totalReports + totalDisputes,
        inPeriod: complaintsInPeriod,
        inPreviousPeriod: complaintsPrevious,
        open: openComplaints,
        openReports,
        openDisputes,
        reportsInPeriod,
        disputesInPeriod,
        reportsTotal: totalReports,
        disputesTotal: totalDisputes,
        change: percentageChange(complaintsInPeriod, complaintsPrevious),
      },
      users: {
        total: totalUsers,
        newInPeriod: newUsers,
        newInPreviousPeriod: newUsersPrevious,
        activeInPeriod: activeUsers,
        activeInPreviousPeriod: activeUsersPrevious,
        inactive: inactiveUsers,
        churned: churnedUsers,
        deactivated: deactivatedUsers,
        suspended: suspendedUsers,
        churnRate: rate(churnedUsers, activeUsersPrevious),
        retentionRate: activeUsersPrevious > 0 ? 100 - rate(churnedUsers, activeUsersPrevious) : 0,
        newChange: percentageChange(newUsers, newUsersPrevious),
        activeChange: percentageChange(activeUsers, activeUsersPrevious),
      },
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
          emailVerified: true,
          phoneVerified: true,
          createdAt: true,
          providers: {
            select: {
              id: true,
              businessName: true,
              providerType: true,
              verificationStatus: true,
              subscriptionStatus: true,
              availabilityStatus: true,
            },
            orderBy: { createdAt: 'asc' },
          },
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
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        providers: {
          select: {
            id: true,
            businessName: true,
            providerType: true,
            verificationStatus: true,
            subscriptionStatus: true,
            availabilityStatus: true,
          },
          orderBy: { createdAt: 'asc' },
        },
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

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        locale: true,
        createdAt: true,
        updatedAt: true,
        clientProfile: {
          select: {
            id: true,
            bio: true,
            createdAt: true,
            _count: { select: { serviceRequests: true, bookings: true, reviews: true } },
          },
        },
        providers: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            businessName: true,
            description: true,
            bio: true,
            phone: true,
            providerType: true,
            onboardingStep: true,
            onboardingCompletedAt: true,
            logoUrl: true,
            registrationNumber: true,
            representativeName: true,
            teamSize: true,
            serviceRadiusKm: true,
            yearsOfExperience: true,
            verificationStatus: true,
            identityVerified: true,
            businessVerified: true,
            verificationExpiresAt: true,
            rating: true,
            reviewCount: true,
            verifiedReviewCount: true,
            responseRate: true,
            responseTimeMinutes: true,
            availabilityStatus: true,
            subscriptionStatus: true,
            createdAt: true,
            updatedAt: true,
            location: {
              select: {
                id: true,
                label: true,
                addressLine: true,
                city: true,
                country: true,
                latitude: true,
                longitude: true,
              },
            },
            workspace: { select: { id: true, name: true, type: true, status: true } },
            services: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                basePrice: true,
                priceType: true,
                duration: true,
                currency: true,
                isActive: true,
                createdAt: true,
                service: {
                  select: {
                    id: true,
                    name: true,
                    category: { select: { id: true, name: true, slug: true } },
                  },
                },
              },
            },
            verifications: {
              orderBy: { submittedAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                status: true,
                legalName: true,
                referenceNumber: true,
                decisionNote: true,
                submittedAt: true,
                reviewedAt: true,
                verifiedAt: true,
                expiresAt: true,
                serviceOffering: {
                  select: { id: true, title: true, service: { select: { name: true } } },
                },
              },
            },
            subscriptions: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                status: true,
                startDate: true,
                endDate: true,
                renewalDate: true,
                createdAt: true,
                plan: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    currency: true,
                    billingInterval: true,
                  },
                },
              },
            },
            _count: {
              select: {
                services: true,
                bookings: true,
                reviews: true,
                serviceRequests: true,
                verifications: true,
              },
            },
          },
        },
        providerApplications: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            businessName: true,
            providerType: true,
            decisionNote: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
        _count: {
          select: {
            reportsFiled: true,
            disputesRaised: true,
            disputesAgainst: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProvider(adminId: string, providerId: string, dto: AdminUpdateProviderDto) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, workspaceId: true, businessName: true, providerType: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const data: Prisma.ProviderUpdateInput = {};
    if (dto.businessName !== undefined) data.businessName = dto.businessName.trim();
    if (dto.description !== undefined) data.description = dto.description.trim() || null;
    if (dto.bio !== undefined) data.bio = dto.bio.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.providerType !== undefined) data.providerType = dto.providerType;
    if (dto.yearsOfExperience !== undefined) data.yearsOfExperience = dto.yearsOfExperience;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber.trim() || null;
    if (dto.representativeName !== undefined) data.representativeName = dto.representativeName.trim() || null;
    if (dto.teamSize !== undefined) data.teamSize = dto.teamSize;
    if (dto.serviceRadiusKm !== undefined) data.serviceRadiusKm = dto.serviceRadiusKm;

    if (Object.keys(data).length === 0) throw new BadRequestException('Nothing to update');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.provider.update({ where: { id: providerId }, data });
      if (dto.providerType !== undefined) {
        await tx.workspace.update({
          where: { id: provider.workspaceId },
          data: { type: dto.providerType },
        });
      }
      return row;
    });

    await this.auditLog.log(adminId, 'PROVIDER_UPDATED', 'Provider', providerId, {
      fields: Object.keys(data),
      previousBusinessName: provider.businessName,
    });

    return updated;
  }

  async verifyProvider(adminId: string, providerId: string, note?: string) {
    return this.verification.adminVerifyProvider(adminId, providerId, note);
  }

  async unverifyProvider(adminId: string, providerId: string, reason: string) {
    return this.verification.adminUnverifyProvider(adminId, providerId, reason);
  }

  // Account deletion is anonymization-in-place: financial and booking history
  // must survive for both sides of a transaction, but the person's identifying
  // details should not. The row stays so existing providers/clients keep their
  // history, while login is impossible (random password hash + revoked tokens).
  async deleteUser(adminId: string, targetUserId: string) {
    if (adminId === targetUserId) {
      throw new BadRequestException('You cannot delete your own account from here');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Admin accounts cannot be deleted from here');

    const anonymizedEmail = `deleted+${targetUserId}@deleted.biilocalfinder.local`;
    const providerIds = await this.prisma.provider.findMany({
      where: { userId: targetUserId },
      select: { id: true, workspaceId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.deleteMany({ where: { userId: targetUserId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: targetUserId } });
      await tx.favorite.deleteMany({ where: { userId: targetUserId } });
      await tx.savedSearch.deleteMany({ where: { userId: targetUserId } });
      await tx.pushSubscription.deleteMany({ where: { userId: targetUserId } });
      await tx.contactVerificationCode.deleteMany({ where: { userId: targetUserId } });

      await tx.clientProfile.updateMany({
        where: { userId: targetUserId },
        data: { bio: null },
      });

      for (const provider of providerIds) {
        await tx.portfolio.deleteMany({ where: { providerId: provider.id } });
        await tx.providerExperience.deleteMany({ where: { providerId: provider.id } });
        await tx.providerEducation.deleteMany({ where: { providerId: provider.id } });
        await tx.provider.update({
          where: { id: provider.id },
          data: {
            businessName: 'Deleted provider',
            description: null,
            bio: null,
            phone: null,
            logoUrl: null,
            registrationNumber: null,
            representativeName: null,
            availabilityStatus: 'UNAVAILABLE',
          },
        });
        await tx.workspace.update({
          where: { id: provider.workspaceId },
          data: { name: 'Deleted workspace' },
        });
      }

      await tx.user.update({
        where: { id: targetUserId },
        data: {
          email: anonymizedEmail,
          phone: null,
          firstName: 'Deleted',
          lastName: 'Account',
          avatarUrl: null,
          passwordHash: `deleted-${randomUUID()}`,
          status: 'DEACTIVATED',
          emailVerified: false,
          phoneVerified: false,
          locale: 'en',
        },
      });
    });

    await this.auditLog.log(adminId, 'USER_DELETED', 'User', targetUserId, {
      previousEmail: user.email,
      providers: providerIds.map((p) => p.id),
      anonymized: true,
    });

    return { id: targetUserId, deleted: true, anonymized: true };
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
