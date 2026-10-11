import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

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
      this.prisma.report.count({ where: { resolvedAt: null } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } } }),
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
    const where = { role: query.role, status: query.status };

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

    const updated = await this.prisma.user.update({ where: { id: targetUserId }, data: { status } });

    await this.auditLog.log(
      adminUserId,
      status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_ACTIVATED',
      'User',
      targetUserId,
    );

    return updated;
  }

  async auditLogs(page = 1) {
    const limit = 50;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return { items, total, page, limit };
  }
}
