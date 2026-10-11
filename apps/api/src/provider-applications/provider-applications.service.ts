import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { slugify } from '../common/utils/slugify';
import { SubmitProviderApplicationDto } from './dto/submit-application.dto';
import { ReviewProviderApplicationDto, RejectProviderApplicationDto } from './dto/review-application.dto';

const APPLICATION_INCLUDE = {
  user: {
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
      clientProfile: { select: { id: true } },
      providers: { select: { id: true, businessName: true } },
    },
  },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class ProviderApplicationsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private auditLog: AuditLogService,
  ) {}

  // ---------- Client side ----------

  /**
   * A client asks to trade on the marketplace.
   *
   * Deliberately does NOT create a Provider/Workspace: approval does that, so
   * a rejected application leaves no half-built provider profile behind and a
   * PENDING application cannot be reached by any public surface.
   */
  async submit(userId: string, dto: SubmitProviderApplicationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new NotFoundException('Account not found');

    // Someone who already trades has nothing to apply for, and letting them
    // through would create a second workspace for the same account.
    if (user.role === 'PROVIDER') {
      throw new ConflictException('This account is already a provider');
    }
    if (user.role === 'ADMIN') {
      throw new ForbiddenException('Admin accounts cannot apply to become a provider');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Your account is not active');
    }

    const pending = await this.prisma.providerApplication.findFirst({
      where: { userId, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('You already have an application awaiting review');
    }

    let application;
    try {
      application = await this.prisma.providerApplication.create({
        data: {
          userId,
          providerType: dto.providerType,
          businessName: dto.businessName.trim(),
          description: dto.description?.trim() || null,
          phone: dto.phone?.trim() || null,
          yearsOfExperience: dto.yearsOfExperience,
          registrationNumber: dto.registrationNumber?.trim() || null,
          idNumber: dto.idNumber?.trim() || null,
          websiteUrl: dto.websiteUrl?.trim() || null,
          categories: dto.categories ?? [],
        },
        include: APPLICATION_INCLUDE,
      });
    } catch (err) {
      // The partial unique index (one PENDING per user) is the real guard — a
      // double submit from two tabs races the read above. Without this the
      // loser gets a raw 500 instead of the 409 it means.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You already have an application awaiting review');
      }
      throw err;
    }

    await this.auditLog.log(userId, 'PROVIDER_APPLICATION_SUBMITTED', 'ProviderApplication', application.id, {
      providerType: dto.providerType,
    });

    return application;
  }

  // The applicant's own history, newest first. Powers the status banner on the
  // apply page so a rejected applicant can see why and reapply.
  async listMine(userId: string) {
    return this.prisma.providerApplication.findMany({
      where: { userId },
      include: APPLICATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- Admin side ----------

  async listForReview(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.prisma.providerApplication.findMany({
      where: status ? { status } : {},
      include: APPLICATION_INCLUDE,
      // Oldest first: a queue should be worked in arrival order.
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const application = await this.prisma.providerApplication.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  /**
   * Approves the application and promotes the applicant's EXISTING account.
   *
   * This is the whole point of the feature: the same user row, login and
   * ClientProfile carry over, so their requests, bookings, reviews and
   * conversations are still theirs. Creating a second user (the old
   * /register route) is what stranded that history.
   */
  async approve(id: string, adminId: string, dto: ReviewProviderApplicationDto) {
    const application = await this.findOne(id);
    if (application.status !== 'PENDING') {
      throw new ConflictException(`This application was already ${application.status.toLowerCase()}`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: application.userId },
      select: { id: true, role: true, status: true, firstName: true, lastName: true },
    });
    if (!user) throw new NotFoundException('Applicant account not found');
    if (user.status !== 'ACTIVE') {
      throw new ConflictException('That account is suspended — activate it before approving');
    }

    // Re-checked inside the transaction: between the read above and the write,
    // the applicant may have become a provider by some other route.
    if (user.role === 'PROVIDER') {
      throw new ConflictException('That account is already a provider');
    }

    const provider = await this.prisma.$transaction(async (tx) => {
      // Claim the row FIRST, and claim it conditionally. The status check above
      // is only a courtesy for a good error message: two admins clicking
      // Approve at the same moment both read PENDING, so without an atomic
      // claim each would build a workspace and a provider for the same person.
      // updateMany with status in the WHERE is the only place that race can be
      // settled, and doing it first means a loser aborts before writing
      // anything rather than half-upgrading the account.
      const claimed = await tx.providerApplication.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
          reviewedById: adminId,
          decisionNote: dto.note?.trim() || null,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('This application was already decided');
      }

      // Same reasoning for the upgrade itself: conditional, so an account that
      // became a provider through some other route can't collect a second
      // provider row. ClientProfile is deliberately untouched either way — a
      // provider can still hire other providers, so their own request history
      // must not disappear when they start trading.
      const upgraded = await tx.user.updateMany({
        where: { id: user.id, role: { not: 'PROVIDER' } },
        data: { role: 'PROVIDER' },
      });
      if (upgraded.count !== 1) {
        throw new ConflictException('That account is already a provider');
      }

      const workspace = await tx.workspace.create({
        data: {
          name: application.businessName,
          slug: await this.uniqueWorkspaceSlug(tx, application.businessName),
          // The applied type drives both rows, so the workspace switcher and
          // the provider agree from the very first login.
          type: application.providerType,
          ownerId: user.id,
        },
      });

      const created = await tx.provider.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          businessName: application.businessName,
          description: application.description,
          phone: application.phone,
          yearsOfExperience: application.yearsOfExperience ?? 0,
          providerType: application.providerType,
          // The applied details already cover type selection and the basics,
          // so resume at "profile details" and let them add services and
          // finish onboarding — rather than dropping them at step 1 asking
          // questions the application just answered.
          onboardingStep: 'PROFILE_DETAILS',
          registrationNumber: application.registrationNumber,
          representativeName:
            application.providerType === 'INDIVIDUAL'
              ? `${user.firstName} ${user.lastName}`
              : null,
          teamSize: application.providerType === 'TEAM' ? 1 : null,
        },
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });

      return created;
    });

    await this.auditLog.log(adminId, 'PROVIDER_APPLICATION_APPROVED', 'ProviderApplication', id, {
      userId: user.id,
      providerId: provider.id,
      providerType: application.providerType,
    });

    await this.notifications.notify({
      userId: user.id,
      type: 'NEW_MESSAGE',
      title: 'Your provider application was approved',
      body: `${application.businessName} is live. Finish setting up your services to start receiving requests.`,
      data: { providerId: provider.id },
    });

    return provider;
  }

  async reject(id: string, adminId: string, dto: RejectProviderApplicationDto) {
    const application = await this.findOne(id);
    if (application.status !== 'PENDING') {
      throw new ConflictException(`This application was already ${application.status.toLowerCase()}`);
    }

    // Atomic claim for the same reason as approve(): a reject racing an approve
    // must not be able to land on top of it and rewrite the decision.
    const claimed = await this.prisma.providerApplication.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedById: adminId,
        decisionNote: dto.reason.trim(),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('This application was already decided');
    }

    const updated = await this.prisma.providerApplication.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });

    await this.auditLog.log(adminId, 'PROVIDER_APPLICATION_REJECTED', 'ProviderApplication', id, {
      userId: application.userId,
    });

    await this.notifications.notify({
      userId: application.userId,
      type: 'NEW_MESSAGE',
      title: 'Your provider application was not approved',
      body: dto.reason.trim(),
      data: { applicationId: id },
    });

    return updated;
  }

  // Same slug algorithm as AuthService.uniqueWorkspaceSlug, so a brand-new
  // signup and an approved application cannot collide on a name.
  private async uniqueWorkspaceSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base = slugify(name) || 'workspace';
    let candidate = base;
    let suffix = 1;
    while (await tx.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}