import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { slugify } from '../common/utils/slugify';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { EMAIL_SENDER, EmailSender } from '../notifications/channels/email-sender';
import { workspaceInviteEmail } from '../auth/auth-email-templates';
import * as crypto from 'crypto';

// Public-safe summary of the Provider that is this workspace's profile —
// deliberately excludes anything not already public on a provider profile.
const WORKSPACE_PROVIDER_SUMMARY = {
  id: true,
  businessName: true,
  logoUrl: true,
  verificationStatus: true,
  subscriptionStatus: true,
  availabilityStatus: true,
  rating: true,
  reviewCount: true,
} as const;

type WorkspaceProviderSummaryRow = Prisma.ProviderGetPayload<{
  select: typeof WORKSPACE_PROVIDER_SUMMARY;
}>;

// Provider.rating is `Decimal @db.Decimal(3,2)`, and Prisma's Decimal
// serialises through JSON.stringify as a *string* ("4.50") — not a number.
// Returning the column as-is therefore made this endpoint contradict the web
// app's declared `WorkspaceProviderSummary.rating: number`, and
// `provider.rating.toFixed(1)` in the dashboard threw
// "provider.rating.toFixed is not a function". Converting at this boundary is
// the same thing ProvidersService.compare and PostgresProviderSearchService
// already do for their Decimal columns; this keeps one wire format for the
// field everywhere.
function toWireProviderSummary(row: WorkspaceProviderSummaryRow) {
  return { ...row, rating: Number(row.rating) };
}

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private entitlements: EntitlementsService,
    @Inject(EMAIL_SENDER) private emailSender?: EmailSender,
  ) {}

  // POST /workspaces — the concrete feature all the "provider multi-
  // ownership" prep (Provider.userId no longer @unique,
  // ProviderContextService, this project's whole Phase-3-of-Phase-2 TODO)
  // was for: a user creating a second, independently owned workspace of
  // a different type (spec §1's own example — a plumber's individual
  // workspace AND a separate cleaning-business workspace). Unlike a
  // user's very first provider (created step-by-step through
  // ProvidersService's onboarding flow, since that's still keyed by
  // userId only — see docs/WORKSPACES.md), an additional workspace is
  // created complete and immediately usable: the owner already knows the
  // platform, and every piece of it they need next (switcher, members,
  // billing) is workspace-scoped already.
  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.uniqueSlug(dto.name);

    const workspace = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const ws = await tx.workspace.create({
        data: {
          name: dto.name,
          slug,
          type: dto.type,
          ownerId: userId,
          onboardingStep: 'COMPLETED',
          onboardingCompletedAt: new Date(),
        },
      });
      await tx.provider.create({
        data: { userId, workspaceId: ws.id, businessName: dto.name, providerType: dto.type },
      });
      await tx.workspaceMembership.create({
        data: { workspaceId: ws.id, userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
      });
      return ws;
    });

    await this.auditLog.log(userId, 'WORKSPACE_CREATED', 'Workspace', workspace.id, { type: dto.type });
    return this.getContext(workspace.id);
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'workspace';
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  // GET /workspaces — the workspace switcher's data source (spec §1: "A
  // user may own or belong to multiple workspaces and switch between them
  // without creating multiple login accounts"). Includes workspaces the
  // user only has a MEMBER/MANAGER role in, not just ones they own, AND
  // pending invitations (status INVITED) so the frontend has somewhere to
  // show/accept them — WorkspaceMembershipGuard only allows ACTIVE
  // members past it, so an invitee needs this to discover the invite at
  // all before they can accept it.
  async listMine(userId: string) {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId, status: { in: ['ACTIVE', 'INVITED'] } },
      include: { workspace: { include: { provider: { select: WORKSPACE_PROVIDER_SUMMARY } } } },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m: (typeof memberships)[number]) => ({
      membershipId: m.id,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
      workspace: m.workspace,
    }));
  }

  // GET /workspaces/:workspaceId — full dashboard context for the
  // workspace switcher's active selection. WorkspaceMembershipGuard has
  // already verified the caller is an active member before this runs.
  async getContext(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        provider: { select: WORKSPACE_PROVIDER_SUMMARY },
        memberships: { where: { status: 'ACTIVE' }, select: { id: true, userId: true, role: true } },
      },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return {
      ...workspace,
      provider: workspace.provider ? toWireProviderSummary(workspace.provider) : null,
    };
  }

  async update(workspaceId: string, dto: UpdateWorkspaceDto, actorId: string) {
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: dto.name },
    });
    // Provider.businessName is the public-facing name shown in search/
    // profile — keep it in sync so renaming a workspace doesn't leave the
    // marketplace listing showing a stale name.
    await this.prisma.provider.updateMany({ where: { workspaceId }, data: { businessName: dto.name } });
    await this.auditLog.log(actorId, 'WORKSPACE_UPDATED', 'Workspace', workspaceId, { name: dto.name });
    return workspace;
  }

  async listMembers(workspaceId: string) {
    return this.prisma.workspaceMembership.findMany({
      where: { workspaceId, status: { in: ['ACTIVE', 'INVITED'] } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async inviteMember(workspaceId: string, dto: InviteMemberDto, actorId: string) {
    const email = dto.email.trim().toLowerCase();
    const invitee = await this.prisma.user.findUnique({ where: { email } });
    const existingMembership = invitee
      ? await this.prisma.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
        })
      : null;
    if (existingMembership?.status === 'ACTIVE') {
      throw new ConflictException('This person already has access to this workspace');
    }

    const pendingInvitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!pendingInvitation && existingMembership?.status !== 'INVITED') {
      const provider = await this.prisma.provider.findUnique({ where: { workspaceId } });
      if (provider) await this.entitlements.assertCanAdd(provider, 'teamMembers');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitationData = {
      email,
      role: dto.role,
      tokenHash,
      invitedById: actorId,
      expiresAt,
      acceptedAt: null,
      revokedAt: null,
    };

    const [membership, invitation] = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let membershipRow = existingMembership;
      if (invitee) {
        membershipRow = existingMembership
          ? await tx.workspaceMembership.update({
              where: { id: existingMembership.id },
              data: {
                role: dto.role,
                status: 'INVITED',
                invitedEmail: email,
                invitedAt: new Date(),
                joinedAt: null,
              },
            })
          : await tx.workspaceMembership.create({
              data: {
                workspaceId,
                userId: invitee.id,
                role: dto.role,
                status: 'INVITED',
                invitedEmail: email,
                invitedAt: new Date(),
              },
            });
      }

      const invitationRow = pendingInvitation
        ? await tx.workspaceInvitation.update({
            where: { id: pendingInvitation.id },
            data: invitationData,
          })
        : await tx.workspaceInvitation.create({
            data: { workspaceId, ...invitationData },
          });
      return [membershipRow, invitationRow] as const;
    });

    const [workspace, inviter] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { name: true } }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      }),
    ]);
    try {
      if (this.emailSender) {
        await this.emailSender.send(
          workspaceInviteEmail(
            email,
            workspace.name,
            `${inviter.firstName} ${inviter.lastName}`.trim() || 'A workspace owner',
            dto.role,
            token,
          ),
        );
      }
    } catch (err) {
      this.logger.error(`Workspace invitation email failed for ${email}: ${(err as Error).message}`);
    }

    await this.auditLog.log(actorId, 'WORKSPACE_MEMBER_INVITED', 'WorkspaceInvitation', invitation.id, {
      workspaceId,
      invitedEmail: email,
      invitedUserId: invitee?.id,
      membershipId: membership?.id,
      role: dto.role,
    });

    return invitation;
  }

  async listInvitations(workspaceId: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { invitedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(workspaceId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation || invitation.workspaceId !== workspaceId) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt) throw new BadRequestException('This invitation was already accepted');

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
      });
      const user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (user) {
        await tx.workspaceMembership.updateMany({
          where: { workspaceId, userId: user.id, status: 'INVITED' },
          data: { status: 'REMOVED' },
        });
      }
    });

    await this.auditLog.log(actorId, 'WORKSPACE_INVITATION_REVOKED', 'WorkspaceInvitation', invitationId, {
      workspaceId,
    });
    return { success: true };
  }

  async getInvitation(token: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: this.hashInviteToken(token) },
      include: {
        workspace: { select: { id: true, name: true, type: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired');
    }
    return {
      workspace: invitation.workspace,
      email: invitation.email,
      role: invitation.role,
      inviterName: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`.trim(),
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitationToken(token: string, userId: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash: this.hashInviteToken(token) },
    });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      throw new NotFoundException('This invitation is invalid or has expired');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new BadRequestException('Sign in with the email address this invitation was sent to');
    }

    const membership = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.workspaceMembership.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      });
      const row = existing
        ? await tx.workspaceMembership.update({
            where: { id: existing.id },
            data: {
              role: invitation.role,
              status: 'ACTIVE',
              invitedEmail: null,
              joinedAt: new Date(),
            },
          })
        : await tx.workspaceMembership.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId,
              role: invitation.role,
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return row;
    });

    await this.auditLog.log(userId, 'WORKSPACE_MEMBER_JOINED', 'WorkspaceMembership', membership.id, {
      workspaceId: invitation.workspaceId,
      invitationId: invitation.id,
      role: invitation.role,
    });
    return this.getContext(invitation.workspaceId);
  }

  async updateMemberRole(workspaceId: string, membershipId: string, dto: UpdateMemberRoleDto, actorId: string) {
    const membership = await this.getManageableMembership(workspaceId, membershipId);

    const updated = await this.prisma.workspaceMembership.update({
      where: { id: membershipId },
      data: { role: dto.role },
    });
    await this.auditLog.log(actorId, 'WORKSPACE_MEMBER_ROLE_CHANGED', 'WorkspaceMembership', membershipId, {
      workspaceId,
      from: membership.role,
      to: dto.role,
    });
    return updated;
  }

  async removeMember(workspaceId: string, membershipId: string, actorId: string) {
    await this.getManageableMembership(workspaceId, membershipId);

    // Soft-removed, not deleted — keeps history for audit and prevents a
    // re-invite from colliding with a stale unique(workspaceId, userId) row
    // in an unexpected state.
    const updated = await this.prisma.workspaceMembership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED' },
    });
    await this.auditLog.log(actorId, 'WORKSPACE_MEMBER_REMOVED', 'WorkspaceMembership', membershipId, {
      workspaceId,
    });
    return updated;
  }

  async acceptInvite(workspaceId: string, membershipId: string, userId: string) {
    const membership = await this.prisma.workspaceMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundException('Invitation not found');
    }
    if (membership.userId !== userId) {
      throw new BadRequestException('This invitation is not addressed to you');
    }
    if (membership.status !== 'INVITED') {
      throw new BadRequestException('This invitation is no longer pending');
    }

    return this.prisma.workspaceMembership.update({
      where: { id: membershipId },
      data: { status: 'ACTIVE', joinedAt: new Date() },
    });
  }

  async transferOwnership(workspaceId: string, membershipId: string, actorId: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    const target = await this.prisma.workspaceMembership.findUnique({ where: { id: membershipId } });
    if (!target || target.workspaceId !== workspaceId) throw new NotFoundException('Membership not found');
    if (target.status !== 'ACTIVE') throw new BadRequestException('The new owner must be an active member');
    if (target.role === 'OWNER' || target.userId === workspace.ownerId) {
      throw new BadRequestException('This member already owns the workspace');
    }

    const currentOwner = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: workspace.ownerId } },
    });

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (currentOwner) {
        await tx.workspaceMembership.update({
          where: { id: currentOwner.id },
          data: { role: 'MANAGER' },
        });
      }
      await tx.workspaceMembership.update({
        where: { id: target.id },
        data: { role: 'OWNER' },
      });
      await tx.workspace.update({
        where: { id: workspaceId },
        data: { ownerId: target.userId },
      });
    });

    await this.auditLog.log(actorId, 'WORKSPACE_OWNERSHIP_TRANSFERRED', 'Workspace', workspaceId, {
      workspaceId,
      fromUserId: workspace.ownerId,
      toUserId: target.userId,
      membershipId: target.id,
    });
    return this.getContext(workspaceId);
  }

  async listAudit(workspaceId: string, take = 100) {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'Workspace', entityId: workspaceId },
          { entity: 'WorkspaceMembership', entityId: { in: memberships.map((m) => m.id) } },
          { entity: 'WorkspaceInvitation', metadata: { path: ['workspaceId'], equals: workspaceId } },
          { entity: 'ServiceRequest', metadata: { path: ['workspaceId'], equals: workspaceId } },
          { entity: 'Booking', metadata: { path: ['workspaceId'], equals: workspaceId } },
        ],
      },
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }

  async assignRequest(workspaceId: string, requestId: string, membershipId: string | null | undefined, actorId: string) {
    const provider = await this.prisma.provider.findUnique({ where: { workspaceId } });
    if (!provider) throw new NotFoundException('Provider profile not found');
    if (provider.providerType === 'INDIVIDUAL') {
      throw new BadRequestException('Individual workspaces do not support assignments');
    }
    const request = await this.prisma.serviceRequest.findUnique({ where: { id: requestId } });
    if (!request || request.providerId !== provider.id) throw new NotFoundException('Service request not found');
    const member = await this.resolveAssignment(workspaceId, membershipId);

    const updated = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedMembershipId: member?.id ?? null,
        assignedAt: member ? new Date() : null,
        assignedById: member ? actorId : null,
      },
    });
    await this.auditLog.log(actorId, 'WORKSPACE_REQUEST_ASSIGNED', 'ServiceRequest', requestId, {
      workspaceId,
      assignedMembershipId: member?.id ?? null,
      assignedUserId: member?.userId ?? null,
    });
    return updated;
  }

  async assignBooking(workspaceId: string, bookingId: string, membershipId: string | null | undefined, actorId: string) {
    const provider = await this.prisma.provider.findUnique({ where: { workspaceId } });
    if (!provider) throw new NotFoundException('Provider profile not found');
    if (provider.providerType === 'INDIVIDUAL') {
      throw new BadRequestException('Individual workspaces do not support assignments');
    }
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.providerId !== provider.id) throw new NotFoundException('Booking not found');
    const member = await this.resolveAssignment(workspaceId, membershipId);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        assignedMembershipId: member?.id ?? null,
        assignedAt: member ? new Date() : null,
        assignedById: member ? actorId : null,
      },
    });
    await this.auditLog.log(actorId, 'WORKSPACE_BOOKING_ASSIGNED', 'Booking', bookingId, {
      workspaceId,
      assignedMembershipId: member?.id ?? null,
      assignedUserId: member?.userId ?? null,
    });
    return updated;
  }

  private async resolveAssignment(workspaceId: string, membershipId: string | null | undefined) {
    if (!membershipId) return null;
    const member = await this.prisma.workspaceMembership.findUnique({ where: { id: membershipId } });
    if (!member || member.workspaceId !== workspaceId || member.status !== 'ACTIVE') {
      throw new BadRequestException('The selected member is not active in this workspace');
    }
    return member;
  }

  private hashInviteToken(token: string): string {
    const secret = process.env.WORKSPACE_INVITE_PEPPER ?? process.env.JWT_SECRET ?? 'insecure-invite-pepper';
    return crypto.createHmac('sha256', secret).update(token).digest('hex');
  }

  // Shared guard for role/removal changes: the membership must exist in
  // this workspace and must not be the OWNER row (ownership isn't
  // transferred or revoked through the member-management endpoints).
  private async getManageableMembership(workspaceId: string, membershipId: string) {
    const membership = await this.prisma.workspaceMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.role === 'OWNER') {
      throw new BadRequestException('The workspace owner cannot be modified here');
    }
    return membership;
  }
}
