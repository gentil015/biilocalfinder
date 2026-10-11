import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Provider, ProviderType, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Provider.providerType is nullable until the provider finishes the
// type_selection onboarding step, so every entitlement decision has to
// cope with null. Treat it as INDIVIDUAL rather than "unknown": that's
// what manual-sql/007 backfilled pre-existing solo providers to, and a
// user who hasn't picked TEAM/BUSINESS/AGENCY yet *is* a solo provider.
// Keeping this in one place stops a mid-onboarding provider from
// resolving to no plan at all (SubscriptionPlan.workspaceType is
// non-null, so querying by null would silently match nothing).
function effectiveProviderType(providerType: ProviderType | null): ProviderType {
  return providerType ?? 'INDIVIDUAL';
}

export type EntitlementResource = 'services' | 'portfolioItems' | 'teamMembers' | 'managedProviders';

const RESOURCE_LIMIT_FIELD: Record<EntitlementResource, keyof SubscriptionPlan> = {
  services: 'maxServices',
  portfolioItems: 'maxPortfolioImages',
  teamMembers: 'maxTeamMembers',
  managedProviders: 'maxManagedProviders',
};

const RESOURCE_LABEL: Record<EntitlementResource, string> = {
  services: 'service listings',
  portfolioItems: 'portfolio items',
  teamMembers: 'team members',
  managedProviders: 'managed providers',
};

// Conservative built-in fallback if a provider's type has no active
// subscription AND no FREE plan has been seeded for that type yet (should
// never happen once prisma/seed.ts has run, but the app must not treat a
// missing seed row as "unlimited" — that would be a silent entitlement
// bypass, spec §8: "Hiding a frontend button is not sufficient
// authorization").
const HARD_FALLBACK: Record<EntitlementResource, number> = {
  services: 2,
  portfolioItems: 3,
  teamMembers: 1,
  managedProviders: 0,
};

// spec §7: "Use a centralized subscription and entitlement system" / "Do
// not hardcode subscription rules throughout frontend components or
// backend controllers." Every module that needs to cap something a plan
// governs (service-offerings, portfolio, workspace members, the agency
// roster) calls this instead of rolling its own limit check — see the
// TODO(subscriptions)/TODO(Phase 7) comments this replaces in
// service-offerings.service.ts and portfolio.service.ts.
@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  // The plan currently governing a provider: their ACTIVE subscription's
  // plan if they have one, otherwise the FREE plan for their type — a
  // provider always has *some* effective plan, never an unbounded one.
  async getEffectivePlan(provider: Pick<Provider, 'id' | 'providerType'>): Promise<SubscriptionPlan | null> {
    const activeSubscription = await this.prisma.providerSubscription.findFirst({
      where: { providerId: provider.id, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSubscription) return activeSubscription.plan;

    return this.prisma.subscriptionPlan.findFirst({
      where: { workspaceType: effectiveProviderType(provider.providerType), name: 'FREE', isActive: true },
    });
  }

  // Usage summary for a dashboard's billing page: current plan + each
  // resource's limit and how much of it is used. Never trusted by the
  // frontend as authorization — assertCanAdd below is what actually
  // blocks a request; this is display-only.
  async getUsageSummary(provider: Provider) {
    const plan = await this.getEffectivePlan(provider);
    const [services, portfolioItems, teamMembers, managedProviders] = await Promise.all([
      this.prisma.serviceOffering.count({ where: { providerId: provider.id } }),
      this.prisma.portfolioImage.count({ where: { portfolio: { providerId: provider.id } } }),
      provider.workspaceId
        ? this.prisma.workspaceMembership.count({ where: { workspaceId: provider.workspaceId, status: 'ACTIVE' } })
        : Promise.resolve(0),
      this.prisma.providerTeamMember.count({ where: { providerId: provider.id } }),
    ]);

    const usage: Record<EntitlementResource, number> = { services, portfolioItems, teamMembers, managedProviders };

    return {
      plan,
      resources: (Object.keys(RESOURCE_LIMIT_FIELD) as EntitlementResource[]).map((resource) => ({
        resource,
        label: RESOURCE_LABEL[resource],
        used: usage[resource],
        limit: this.resolveLimit(plan, provider.providerType, resource),
      })),
    };
  }

  // Throws if adding one more `resource` would exceed the provider's
  // current plan — call this BEFORE creating the row, never after
  // (spec §8: "Prevent exceeding limits through API requests"). A
  // downgrade never deletes existing rows (spec §7): a provider already
  // over a new, lower limit simply can't add more until they're back
  // under it — this check achieves that for free, with no separate
  // downgrade-cleanup logic needed.
  async assertCanAdd(provider: Pick<Provider, 'id' | 'providerType' | 'workspaceId'>, resource: EntitlementResource) {
    const plan = await this.getEffectivePlan(provider as Provider);
    const limit = this.resolveLimit(plan, provider.providerType, resource);
    if (limit === null) return; // unlimited on this plan

    const currentCount = await this.countCurrent(provider, resource);
    if (currentCount >= limit) {
      throw new BadRequestException(
        `Your plan allows up to ${limit} ${RESOURCE_LABEL[resource]}. Upgrade to add more.`,
      );
    }
  }

  // spec §7: "A workspace must only be assigned plans compatible with its
  // workspace type" — enforced here so it can't be bypassed by whatever
  // planId a client sends, not just filtered out of the plan list shown.
  assertPlanMatchesType(plan: SubscriptionPlan, providerType: ProviderType | null) {
    const type = effectiveProviderType(providerType);
    if (plan.workspaceType !== type) {
      throw new ForbiddenException(
        `The "${plan.name}" plan is for ${plan.workspaceType.toLowerCase()} workspaces, not ${type.toLowerCase()} ones`,
      );
    }
  }

  private resolveLimit(plan: SubscriptionPlan | null, providerType: ProviderType | null, resource: EntitlementResource): number | null {
    const type = effectiveProviderType(providerType);
    if (!plan) return HARD_FALLBACK[resource];
    const value = plan[RESOURCE_LIMIT_FIELD[resource]];
    // Schema-level null means "unlimited" for services/portfolio/monthly
    // requests, but teamMembers/managedProviders are only meaningful for
    // TEAM/BUSINESS and AGENCY respectively — null on an irrelevant type
    // isn't "unlimited", it's "not applicable", so treat it as 0 there to
    // avoid an INDIVIDUAL plan accidentally granting unlimited managed
    // providers just because the column was never set.
    if (resource === 'teamMembers' && !['TEAM', 'BUSINESS'].includes(type)) return 0;
    if (resource === 'managedProviders' && type !== 'AGENCY') return 0;
    return typeof value === 'number' ? value : null;
  }

  private countCurrent(provider: Pick<Provider, 'id' | 'workspaceId'>, resource: EntitlementResource) {
    switch (resource) {
      case 'services':
        return this.prisma.serviceOffering.count({ where: { providerId: provider.id } });
      case 'portfolioItems':
        return this.prisma.portfolioImage.count({ where: { portfolio: { providerId: provider.id } } });
      case 'teamMembers':
        return provider.workspaceId
          ? this.prisma.workspaceMembership.count({
              where: { workspaceId: provider.workspaceId, status: { in: ['ACTIVE', 'INVITED'] } },
            })
          : Promise.resolve(0);
      case 'managedProviders':
        return this.prisma.providerTeamMember.count({ where: { providerId: provider.id } });
    }
  }
}
