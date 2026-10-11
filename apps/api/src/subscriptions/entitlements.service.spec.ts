import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: any;

  const freePlan = {
    id: 'plan-free',
    workspaceType: 'INDIVIDUAL',
    name: 'FREE',
    maxServices: 2,
    maxPortfolioImages: 3,
    maxTeamMembers: null,
    maxManagedProviders: null,
  };

  beforeEach(() => {
    prisma = {
      providerSubscription: { findFirst: jest.fn().mockResolvedValue(null) },
      subscriptionPlan: { findFirst: jest.fn().mockResolvedValue(freePlan) },
      serviceOffering: { count: jest.fn().mockResolvedValue(0) },
      portfolioImage: { count: jest.fn().mockResolvedValue(0) },
      workspaceMembership: { count: jest.fn().mockResolvedValue(0) },
      providerTeamMember: { count: jest.fn().mockResolvedValue(0) },
    };
    service = new EntitlementsService(prisma);
  });

  describe('getEffectivePlan', () => {
    it('uses the active subscription plan when one exists', async () => {
      const proPlan = { ...freePlan, id: 'plan-pro', name: 'PRO' };
      prisma.providerSubscription.findFirst.mockResolvedValue({ plan: proPlan });

      const plan = await service.getEffectivePlan({ id: 'p1', providerType: 'INDIVIDUAL' } as any);

      expect(plan).toBe(proPlan);
      expect(prisma.subscriptionPlan.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to the FREE plan for the provider type when there is no active subscription', async () => {
      const plan = await service.getEffectivePlan({ id: 'p1', providerType: 'INDIVIDUAL' } as any);

      expect(plan).toBe(freePlan);
      expect(prisma.subscriptionPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceType: 'INDIVIDUAL', name: 'FREE' }) }),
      );
    });
  });

  describe('assertCanAdd', () => {
    it('allows adding under the limit', async () => {
      prisma.serviceOffering.count.mockResolvedValue(1);
      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'INDIVIDUAL', workspaceId: 'ws1' } as any, 'services'),
      ).resolves.toBeUndefined();
    });

    it('blocks adding at the limit', async () => {
      prisma.serviceOffering.count.mockResolvedValue(2);
      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'INDIVIDUAL', workspaceId: 'ws1' } as any, 'services'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('never allows unlimited teamMembers/managedProviders on a type they do not apply to', async () => {
      // maxTeamMembers is null on the fixture plan, which would mean
      // "unlimited" for services/portfolio — but teamMembers isn't
      // applicable to INDIVIDUAL at all, so it must resolve to a hard 0,
      // not unlimited.
      prisma.workspaceMembership.count.mockResolvedValue(0);
      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'INDIVIDUAL', workspaceId: 'ws1' } as any, 'teamMembers'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('respects a real maxTeamMembers limit for TEAM', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ ...freePlan, workspaceType: 'TEAM', maxTeamMembers: 2 });
      prisma.workspaceMembership.count.mockResolvedValue(1);

      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'TEAM', workspaceId: 'ws1' } as any, 'teamMembers'),
      ).resolves.toBeUndefined();

      prisma.workspaceMembership.count.mockResolvedValue(2);
      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'TEAM', workspaceId: 'ws1' } as any, 'teamMembers'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows unlimited when the plan field is null and the resource applies to the type', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue({ ...freePlan, maxServices: null });
      prisma.serviceOffering.count.mockResolvedValue(1000);

      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'INDIVIDUAL', workspaceId: 'ws1' } as any, 'services'),
      ).resolves.toBeUndefined();
    });

    it('falls back to a conservative hard limit if no FREE plan is seeded for the type', async () => {
      prisma.subscriptionPlan.findFirst.mockResolvedValue(null);
      prisma.serviceOffering.count.mockResolvedValue(2);

      await expect(
        service.assertCanAdd({ id: 'p1', providerType: 'INDIVIDUAL', workspaceId: 'ws1' } as any, 'services'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('assertPlanMatchesType', () => {
    it('rejects a plan whose workspaceType does not match the provider', () => {
      expect(() => service.assertPlanMatchesType(freePlan as any, 'AGENCY' as any)).toThrow(ForbiddenException);
    });

    it('allows a matching plan', () => {
      expect(() => service.assertPlanMatchesType(freePlan as any, 'INDIVIDUAL' as any)).not.toThrow();
    });
  });
});
