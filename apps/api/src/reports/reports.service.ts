import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

const MAX_OPEN_REPORTS_PER_TARGET_PER_USER = 1;

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  // Confirms the target actually exists before filing a report against it —
  // an admin working a stale or fabricated targetId is a dead end, not
  // something worth surfacing in the moderation queue.
  private async assertTargetExists(targetType: ReportTargetType, targetId: string) {
    const exists: unknown =
      targetType === 'USER'
        ? await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
        : targetType === 'PROVIDER'
          ? await this.prisma.provider.findUnique({ where: { id: targetId }, select: { id: true } })
          : targetType === 'MESSAGE'
            ? await this.prisma.message.findUnique({ where: { id: targetId }, select: { id: true } })
            : targetType === 'BOOKING'
              ? await this.prisma.booking.findUnique({ where: { id: targetId }, select: { id: true } })
              : targetType === 'REVIEW'
                ? await this.prisma.review.findUnique({ where: { id: targetId }, select: { id: true } })
                : await this.prisma.serviceOffering.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!exists) throw new NotFoundException('The thing you tried to report could not be found');
  }

  async create(reporterId: string, dto: CreateReportDto) {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const openCount = await this.prisma.report.count({
      where: { reporterId, targetType: dto.targetType, targetId: dto.targetId, status: { not: 'RESOLVED' } },
    });
    if (openCount >= MAX_OPEN_REPORTS_PER_TARGET_PER_USER) {
      throw new BadRequestException('You already have an open report for this. An admin will review it.');
    }

    return this.prisma.report.create({
      data: { reporterId, targetType: dto.targetType, targetId: dto.targetId, category: dto.category, reason: dto.reason, details: dto.details },
    });
  }

  async findAll(status?: string, category?: string, page = 1) {
    const limit = 20;
    const where: Prisma.ReportWhereInput = {
      ...(status ? { status: status as Prisma.EnumReportStatusFilter['equals'] } : {}),
      ...(category ? { category: category as Prisma.EnumReportCategoryFilter['equals'] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: { reporter: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // The read side of a report: pulls in whatever the target actually is, so
  // an admin doesn't have to open a second tab to see what's being reported.
  async findOneWithTarget(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { reporter: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!report) throw new NotFoundException('Report not found');

    const target =
      report.targetType === 'USER'
        ? await this.prisma.user.findUnique({ where: { id: report.targetId }, select: { id: true, firstName: true, lastName: true, email: true, status: true } })
        : report.targetType === 'PROVIDER'
          ? await this.prisma.provider.findUnique({ where: { id: report.targetId }, select: { id: true, businessName: true, verificationStatus: true } })
          : report.targetType === 'REVIEW'
            ? await this.prisma.review.findUnique({ where: { id: report.targetId }, select: { id: true, rating: true, comment: true, status: true, providerId: true } })
            : report.targetType === 'BOOKING'
              ? await this.prisma.booking.findUnique({ where: { id: report.targetId }, select: { id: true, status: true } })
              : report.targetType === 'SERVICE_OFFERING'
                ? await this.prisma.serviceOffering.findUnique({ where: { id: report.targetId }, select: { id: true, title: true, isActive: true } })
                : await this.prisma.message.findUnique({ where: { id: report.targetId }, select: { id: true, body: true } });

    // The reported content may since have been deleted — that's fine, the
    // report itself is still worth showing.
    return { ...report, target: target ?? null };
  }

  async assign(id: string, adminId: string) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'OPEN') throw new BadRequestException('Only an open report can be picked up');
    return this.prisma.report.update({ where: { id }, data: { status: 'UNDER_REVIEW' } });
  }

  async resolve(id: string, adminId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === 'RESOLVED') throw new BadRequestException('This report is already resolved');

    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: dto.dismiss ? 'DISMISSED' : 'RESOLVED', resolution: dto.resolution, resolvedById: adminId, resolvedAt: new Date() },
    });
    await this.auditLog.log(adminId, dto.dismiss ? 'REPORT_DISMISSED' : 'REPORT_RESOLVED', 'Report', id, {
      targetType: report.targetType,
      targetId: report.targetId,
      resolution: dto.resolution,
    });
    return updated;
  }

  // Counts by target — lets the admin dashboard flag "this provider has 4
  // open reports" without a bespoke query for every screen that needs it.
  async openCountByTarget(targetType: ReportTargetType, targetId: string) {
    return this.prisma.report.count({ where: { targetType, targetId, status: { not: 'RESOLVED' } } });
  }
}
