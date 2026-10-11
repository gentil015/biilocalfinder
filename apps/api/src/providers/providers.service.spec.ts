import { BadRequestException } from '@nestjs/common';
import { ProvidersService } from './providers.service';

describe('ProvidersService — onboarding', () => {
  let service: ProvidersService;
  let prisma: any;

  function baseProvider(overrides: Record<string, any> = {}) {
    return {
      id: 'provider-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      businessName: 'Jane Doe',
      bio: null,
      phone: null,
      registrationNumber: null,
      representativeName: null,
      teamSize: null,
      logoUrl: null,
      providerType: null,
      onboardingStep: 'TYPE_SELECTION',
      locationId: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      provider: { findUnique: jest.fn(), update: jest.fn((args) => args.data) },
      workspace: { update: jest.fn((args) => args.data) },
      // Lets the service's transaction callbacks run against the same mocks.
      $transaction: jest.fn((cb: any) => cb(prisma)),
      serviceOffering: { count: jest.fn().mockResolvedValue(0) },
      providerTeamMember: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    };
    service = new ProvidersService(prisma, {} as any, {} as any, {} as any, {
      assertCanAdd: jest.fn().mockResolvedValue(undefined),
    } as any, {
      // Delegates through the same prisma.provider.findUnique mock every
      // test in this file already sets up, so getOwnProviderRow's switch
      // to ProviderContextService needs no changes to those ~16 existing
      // `prisma.provider.findUnique.mockResolvedValue(...)` fixtures.
      resolveForUser: jest.fn((userId: string) => prisma.provider.findUnique({ where: { userId } })),
    } as any);
  });

  describe('selectProviderType', () => {
    it('advances TYPE_SELECTION -> PROFILE_DETAILS on first selection', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider());

      await service.selectProviderType('user-1', { providerType: 'BUSINESS' as any });

      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
        data: { providerType: 'BUSINESS', onboardingStep: 'PROFILE_DETAILS' },
      });
    });

    it('does not regress the step when re-selecting the same type later', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'SERVICES_SETUP' }),
      );

      await service.selectProviderType('user-1', { providerType: 'INDIVIDUAL' as any });

      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
        data: { providerType: 'INDIVIDUAL', onboardingStep: 'SERVICES_SETUP' },
      });
    });

    it('resets to PROFILE_DETAILS when changing to a different type after progressing', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'BUSINESS', onboardingStep: 'SERVICES_SETUP' }),
      );

      await service.selectProviderType('user-1', { providerType: 'AGENCY' as any });

      expect(prisma.provider.update).toHaveBeenCalledWith({
        where: { id: 'provider-1' },
        data: { providerType: 'AGENCY', onboardingStep: 'PROFILE_DETAILS' },
      });
    });

    // The regression that made a TEAM/BUSINESS provider still present as
    // individual: Workspace.type was left at the INDIVIDUAL that
    // AuthService.register hardcodes, because only the provider row was
    // written. The workspace switcher renders Workspace.type.
    it('syncs Workspace.type with the chosen provider type', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider());

      await service.selectProviderType('user-1', { providerType: 'TEAM' as any });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: expect.objectContaining({ type: 'TEAM' }),
      });
    });

    it('corrects an already-drifted workspace when the type is re-selected', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'TEAM', onboardingStep: 'SERVICES_SETUP' }),
      );

      await service.selectProviderType('user-1', { providerType: 'TEAM' as any });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: expect.objectContaining({ type: 'TEAM' }),
      });
    });

    it('mirrors the onboarding step onto the workspace, not just the type', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider());

      await service.selectProviderType('user-1', { providerType: 'BUSINESS' as any });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: expect.objectContaining({ onboardingStep: 'PROFILE_DETAILS' }),
      });
    });

    it('writes both rows in one transaction, so the pair cannot half-apply', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider());

      await service.selectProviderType('user-1', { providerType: 'BUSINESS' as any });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const applied = prisma.provider.update.mock.results[0].value;
      expect(applied.providerType).toBe('BUSINESS');
    });
  });

  describe('updateOnboardingProfile', () => {
    it('rejects when no provider type has been chosen yet', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: null }));
      await expect(service.updateOnboardingProfile('user-1', {})).rejects.toThrow(BadRequestException);
    });

    it('requires an authorized representative for BUSINESS profiles', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'BUSINESS', onboardingStep: 'PROFILE_DETAILS' }),
      );
      await expect(
        service.updateOnboardingProfile('user-1', { businessName: 'Acme Ltd' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not require a representative for INDIVIDUAL profiles', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'PROFILE_DETAILS' }),
      );
      await expect(
        service.updateOnboardingProfile('user-1', { businessName: 'Jane Doe', bio: 'Plumber' }),
      ).resolves.toBeDefined();
    });

    it('advances PROFILE_DETAILS -> SERVICES_SETUP once required fields are present', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'TEAM', onboardingStep: 'PROFILE_DETAILS' }),
      );

      await service.updateOnboardingProfile('user-1', { businessName: 'Clean Team RW' });

      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ onboardingStep: 'SERVICES_SETUP' }) }),
      );
    });

    it('trusts the stored providerType, not anything the caller implies', async () => {
      // Even though the DTO only carries generic fields (no providerType —
      // that can only be set via selectProviderType), BUSINESS-specific
      // validation still applies because it's read from the DB row.
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'BUSINESS', onboardingStep: 'PROFILE_DETAILS', representativeName: 'Existing Rep' }),
      );
      await expect(
        service.updateOnboardingProfile('user-1', { businessName: 'Acme Ltd' }),
      ).resolves.toBeDefined();
    });
  });

  describe('completeOnboarding', () => {
    it('rejects when there is no location set', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'SERVICES_SETUP', locationId: null }),
      );
      await expect(service.completeOnboarding('user-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects when there are no active offerings', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'SERVICES_SETUP', locationId: 'loc-1' }),
      );
      prisma.serviceOffering.count.mockResolvedValue(0);
      await expect(service.completeOnboarding('user-1')).rejects.toThrow(BadRequestException);
    });

    it('completes once a location and an active offering both exist', async () => {
      prisma.provider.findUnique.mockResolvedValue(
        baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'SERVICES_SETUP', locationId: 'loc-1' }),
      );
      prisma.serviceOffering.count.mockResolvedValue(1);

      await service.completeOnboarding('user-1');

      expect(prisma.provider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ onboardingStep: 'COMPLETED' }) }),
      );
    });

    it('is idempotent once already completed', async () => {
      const completed = baseProvider({ providerType: 'INDIVIDUAL', onboardingStep: 'COMPLETED', locationId: 'loc-1' });
      prisma.provider.findUnique.mockResolvedValue(completed);

      const result = await service.completeOnboarding('user-1');

      expect(result).toBe(completed);
      expect(prisma.provider.update).not.toHaveBeenCalled();
    });
  });

  describe('team roster', () => {
    it('rejects adding a team member to an INDIVIDUAL profile', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: 'INDIVIDUAL' }));
      await expect(service.addTeamMember('user-1', { name: 'Alex' })).rejects.toThrow(BadRequestException);
    });

    it('rejects adding a team member to a BUSINESS profile (representative already covers this)', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: 'BUSINESS' }));
      await expect(service.addTeamMember('user-1', { name: 'Alex' })).rejects.toThrow(BadRequestException);
    });

    it('allows adding a team member to a TEAM profile', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: 'TEAM' }));
      prisma.providerTeamMember.create.mockResolvedValue({ id: 'member-1' });

      await service.addTeamMember('user-1', { name: 'Alex', role: 'Technician' });

      expect(prisma.providerTeamMember.create).toHaveBeenCalledWith({
        data: { providerId: 'provider-1', name: 'Alex', role: 'Technician' },
      });
    });

    it('allows adding a managed/invited provider to an AGENCY profile', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: 'AGENCY' }));
      prisma.providerTeamMember.create.mockResolvedValue({ id: 'member-1' });

      await expect(
        service.addTeamMember('user-1', { email: 'contractor@example.com' }),
      ).resolves.toBeDefined();
    });

    it('rejects a team member with no name, email, or phone at all', async () => {
      prisma.provider.findUnique.mockResolvedValue(baseProvider({ providerType: 'TEAM' }));
      await expect(service.addTeamMember('user-1', {})).rejects.toThrow(BadRequestException);
    });
  });
});
