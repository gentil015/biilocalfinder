import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { slugify } from '../common/utils/slugify';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

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
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    private entitlements: EntitlementsService,
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

  // Invites an EXISTING account by email. Inviting someone with no BII
  // LocalFinder account yet is out of scope for this phase — see
  // schema.prisma's Workspace doc comment; extending this to
  // email-only/no-account invitations is a small, separate follow-up
  // (would need an invite-token + registration-linking flow) and doesn't
  // change the workspace/membership model itself.
  async inviteMember(workspaceId: string, dto: InviteMemberDto, actorId: string) {
    const invitee = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!invitee) {
      throw new NotFoundException(
        'No BII LocalFinder account found for that email yet — ask them to register first',
      );
    }

    const existing = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: invitee.id } },
    });
    if (existing && existing.status !== 'REMOVED') {
      throw new ConflictException('This person already has access to this workspace');
    }

    // Centralized plan-based entitlement (spec §7: "Maximum team
    // members") — a REMOVED-then-reinvited slot still checks the current
    // limit fresh, since the workspace's plan may have changed since.
    const provider = await this.prisma.provider.findUnique({ where: { workspaceId } });
    if (provider) {
      await this.entitlements.assertCanAdd(provider, 'teamMembers');
    }

    const membership = existing
      ? await this.prisma.workspaceMembership.update({
          where: { id: existing.id },
          data: { role: dto.role, status: 'INVITED', invitedEmail: dto.email, invitedAt: new Date(), joinedAt: null },
        })
      : await this.prisma.workspaceMembership.create({
          data: {
            workspaceId,
            userId: invitee.id,
            role: dto.role,
            status: 'INVITED',
            invitedEmail: dto.email,
            invitedAt: new Date(),
          },
        });

    await this.auditLog.log(actorId, 'WORKSPACE_MEMBER_INVITED', 'WorkspaceMembership', membership.id, {
      workspaceId,
      invitedUserId: invitee.id,
      role: dto.role,
    });

    // NOTE: wiring this into NotificationsService (in-app + push, mirroring
    // how team-member invites already notify elsewhere) is a natural next
    // step, left out here to keep this module's own tests DB-only.
    return membership;
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
