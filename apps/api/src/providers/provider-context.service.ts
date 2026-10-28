import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceContextService } from '../common/workspace/workspace-context.service';

// Replaces every `prisma.provider.findUnique({ where: { userId } })` now
// that Provider.userId isn't @unique (see
// prisma/manual-sql/010_provider_multi_ownership.sql and this model's
// doc comment in schema.prisma). Resolution goes through
// WorkspaceMembership, not a raw userId scan, so it naturally covers a
// user acting on a workspace they were invited into, not just one they
// own.
//
// For every account that existed before this change, this returns
// exactly what the old `findUnique` did — one workspace, one provider,
// zero behavior change. It's only a user with more than one *active*
// workspace where this diverges: rather than guessing which one an
// endpoint meant, it fails loudly. Making an endpoint workspace-aware
// (reading an explicit workspace id instead of calling this) is a
// per-endpoint follow-up, tracked in docs/WORKSPACES.md — this service
// is what keeps every endpoint that hasn't been upgraded yet safe in the
// meantime, rather than silently correct only by accident.
@Injectable()
export class ProviderContextService {
  constructor(
    private prisma: PrismaService,
    private workspaceContext: WorkspaceContextService,
  ) {}

  async resolveForUser(userId: string): Promise<Provider> {
    const active = this.workspaceContext.getForUser(userId);
    if (active) {
      if (!active.providerId) throw new NotFoundException('Provider profile not found');
      const provider = await this.prisma.provider.findUnique({ where: { id: active.providerId } });
      if (!provider) throw new NotFoundException('Provider profile not found');
      return provider;
    }
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { workspace: { include: { provider: true } } },
    });
    const providers = memberships
      .map((m: (typeof memberships)[number]) => m.workspace.provider)
      .filter((p): p is NonNullable<typeof p> => !!p);

    if (providers.length === 0) {
      throw new NotFoundException('Provider profile not found');
    }
    if (providers.length > 1) {
      throw new ConflictException(
        'You have more than one workspace and this action doesn\'t support choosing one yet — use the dashboard for the specific workspace you meant.',
      );
    }
    return providers[0];
  }

  // For "list/check across every provider this user can act as" cases
  // (conversations, bookings) — unlike resolveForUser, never throws: a
  // user with zero or several providers just gets an empty or multi-item
  // list back, which is exactly what an OR-across-my-providers query
  // needs.
  async getProviderIdsForUser(userId: string): Promise<string[]> {
    const active = this.workspaceContext.getForUser(userId);
    if (active) return active.providerId ? [active.providerId] : [];
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { workspace: { select: { provider: { select: { id: true } } } } },
    });
    return memberships
      .map((m: (typeof memberships)[number]) => m.workspace.provider?.id)
      .filter((id): id is string => !!id);
  }

  // For "is this user allowed to act as provider X" checks (participant
  // checks on a request/quote/review that already names a specific
  // providerId) — unlike resolveForUser, this is correct even for a user
  // who owns more than one workspace, since it doesn't need to pick
  // "the" provider, just confirm X is one of theirs.
  async userHasAccessToProvider(userId: string, providerId: string): Promise<boolean> {
    const active = this.workspaceContext.getForUser(userId);
    if (active) return active.providerId === providerId;
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId }, select: { workspaceId: true } });
    if (!provider) return false;
    const membership = await this.prisma.workspaceMembership.findUnique({
      where: { workspaceId_userId: { workspaceId: provider.workspaceId, userId } },
    });
    return !!membership && membership.status === 'ACTIVE';
  }
}
