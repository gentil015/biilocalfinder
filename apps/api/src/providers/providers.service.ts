import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityService } from '../availability/availability.service';
import { EntitlementsService } from '../subscriptions/entitlements.service';
import { ProviderContextService } from './provider-context.service';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { SetLocationDto } from './dto/set-location.dto';
import { AddServiceAreaDto } from './dto/add-service-area.dto';
import { SelectProviderTypeDto } from './dto/select-provider-type.dto';
import { UpdateOnboardingProfileDto } from './dto/update-onboarding-profile.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { InteractionService } from '../personalization/interactions/interaction.service';
import { coversPoint, haversineKm } from '../common/utils/geo';
import { Prisma, ProviderOnboardingStep, ProviderType } from '@prisma/client';

// Only TEAM and AGENCY profiles keep a roster (spec: TEAM "allow team
// members to be added later", AGENCY "manage or invite multiple providers
// later"). INDIVIDUAL and BUSINESS have no use for it — a BUSINESS's
// single authorized representative is already captured on the Provider
// row itself (representativeName), not as a roster entry.
const TYPES_WITH_TEAM_ROSTER: ProviderType[] = ['TEAM', 'AGENCY'];

const PUBLIC_PROVIDER_INCLUDE = {
  location: true,
  // Each ServiceOffering carries its own category-specific attribute
  // values (spec: "do not mix attributes from unrelated services") —
  // never rendered from a shared Provider-level field.
  services: {
    where: { isActive: true },
    include: {
      service: { include: { category: true } },
      attributeValues: { include: { categoryAttribute: true } },
    },
  },
  serviceAreas: true,
  availabilities: true,
  portfolios: {
    include: { images: { orderBy: { position: 'asc' as const } }, service: true },
    orderBy: { createdAt: 'desc' as const },
  },
  reviews: {
    take: 5,
    orderBy: { createdAt: 'desc' as const },
    include: { client: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } } },
  },
  user: { select: { firstName: true, lastName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ProvidersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private availability: AvailabilityService,
    private interactions: InteractionService,
    private entitlements: EntitlementsService,
    private providerContext: ProviderContextService,
  ) {}

  async getByUserId(userId: string) {
    // Was `findUnique({ where: { userId } })` — a PrismaClientValidationError
    // at runtime now that Provider.userId isn't @unique (manual-sql/010), so
    // this 500'd. ProviderContextService is the documented replacement.
    const resolved = await this.providerContext.resolveForUser(userId).catch(() => null);
    if (!resolved) throw new NotFoundException('Provider profile not found');

    const provider = await this.prisma.provider.findUnique({
      where: { id: resolved.id },
      include: PUBLIC_PROVIDER_INCLUDE,
    });
    if (!provider) throw new NotFoundException('Provider profile not found');
    return provider;
  }

  async getPublicProfile(id: string, viewerUserId?: string, coords?: { lat: number; lng: number }) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: PUBLIC_PROVIDER_INCLUDE,
    });
    if (!provider) throw new NotFoundException('Provider not found');
    // Incomplete profiles (still mid-onboarding) are never shown publicly
    // (spec: "Prevent incomplete provider profiles from being published
    // publicly") — except to the provider themself, who needs to see their
    // own profile while still finishing setup.
    if (provider.onboardingStep !== 'COMPLETED' && provider.userId !== viewerUserId) {
      throw new NotFoundException('Provider not found');
    }
    if (viewerUserId) {
      await this.interactions.record(viewerUserId, 'VIEW_PROVIDER', 'PROVIDER', id);
    }
    // "Available today" / "Next available: Friday" (spec §3) — derived
    // from the weekly schedule + exceptions, not just the manual status
    // badge shown elsewhere on the card.
    const availability = await this.availability.summaryForProvider(id);

    // "Serves your area" / distance (spec §12) — only computed when the
    // caller passed coordinates (e.g. the client's browser geolocation).
    // Same coversPoint() rule PostgresProviderSearchService uses for
    // servesArea, so this page and search results never disagree.
    let location: { distanceKm: number | null; servesQueriedLocation: boolean | null } = {
      distanceKm: null,
      servesQueriedLocation: null,
    };
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      const distanceKm = provider.location
        ? haversineKm(provider.location.latitude, provider.location.longitude, coords.lat, coords.lng)
        : null;
      const servesQueriedLocation = coversPoint(provider.serviceAreas, coords);
      location = { distanceKm, servesQueriedLocation };
    }

    return { ...provider, availability, ...location };
  }

  // Side-by-side comparison (spec §11) — 2 to 3 providers, the fields a
  // client actually weighs against each other: rating, experience,
  // starting price, verification, response time, and computed
  // availability (reuses AvailabilityService, same source of truth as the
  // profile page and search cards).
  async compare(ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (unique.length < 2) throw new BadRequestException('Pick at least 2 providers to compare');
    if (unique.length > 3) throw new BadRequestException('You can compare up to 3 providers at a time');

    const providers = await this.prisma.provider.findMany({
      where: { id: { in: unique }, onboardingStep: 'COMPLETED' },
      select: {
        id: true,
        businessName: true,
        logoUrl: true,
        rating: true,
        reviewCount: true,
        verifiedReviewCount: true,
        yearsOfExperience: true,
        responseTimeMinutes: true,
        verificationStatus: true,
        businessVerified: true,
        user: { select: { avatarUrl: true } },
        location: { select: { city: true } },
        services: {
          where: { isActive: true, basePrice: { not: null } },
          select: { basePrice: true, currency: true },
          orderBy: { basePrice: 'asc' },
          take: 1,
        },
      },
    });
    if (providers.length !== unique.length) throw new NotFoundException('One or more providers were not found');

    const availabilityById = await this.availability.summariesForProviders(unique);

    // Preserve the order the client asked for rather than however
    // Postgres happened to return rows, so the comparison table's column
    // order matches the order providers were added to the tray.
    const byId = new Map((providers as any[]).map((p) => [p.id, p]));
    return unique.map((id) => {
      const p: any = byId.get(id)!;
      return {
        id: p.id,
        businessName: p.businessName,
        avatarUrl: p.logoUrl ?? p.user?.avatarUrl,
        city: p.location?.city ?? null,
        rating: Number(p.rating),
        reviewCount: p.reviewCount,
        verifiedReviewCount: p.verifiedReviewCount,
        yearsOfExperience: p.yearsOfExperience,
        responseTimeMinutes: p.responseTimeMinutes,
        verificationStatus: p.verificationStatus,
        businessVerified: p.businessVerified,
        startingPrice: p.services?.[0] ? Number(p.services[0].basePrice) : null,
        currency: p.services?.[0]?.currency ?? 'RWF',
        availability: availabilityById.get(id) ?? null,
      };
    });
  }

  async updateProfile(userId: string, dto: UpdateProviderProfileDto) {
    const provider = await this.getByUserId(userId);
    const { phone, ...rest } = dto as any;
    if (phone !== undefined) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { phone: phone?.trim() ? phone.trim() : null },
      });
    }
    return this.prisma.provider.update({
      where: { id: provider.id },
      data: {
        ...rest,
        // An empty logo means "clear it", not "store an empty string".
        ...(rest.logoUrl !== undefined ? { logoUrl: rest.logoUrl.trim() || null } : {}),
      },
    });
  }

  // Service offerings (with category-specific attributes) now live in
  // their own module — see src/service-offerings — since they outgrew a
  // simple add/remove pair once each offering needed its own price type,
  // duration, and dynamic attribute values.

  // --- Location ---

  async setLocation(userId: string, dto: SetLocationDto) {
    const provider = await this.getByUserId(userId);

    const location = await this.prisma.location.create({
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        addressLine: dto.addressLine,
        city: dto.city,
        label: dto.label,
      },
    });
    // NOTE: a DB trigger (added in the Phase 3 PostGIS migration) keeps
    // `locations.geom` (geography point) in sync with lat/lng automatically.

    return this.prisma.provider.update({
      where: { id: provider.id },
      data: { locationId: location.id },
      include: { location: true },
    });
  }

  // --- Service areas ---

  async addServiceArea(userId: string, dto: AddServiceAreaDto) {
    const provider = await this.getByUserId(userId);
    return this.prisma.serviceArea.create({
      data: { providerId: provider.id, ...dto },
    });
  }

  async removeServiceArea(userId: string, areaId: string) {
    const provider = await this.getByUserId(userId);
    const area = await this.prisma.serviceArea.findUnique({ where: { id: areaId } });
    if (!area || area.providerId !== provider.id) throw new NotFoundException('Not found');
    await this.prisma.serviceArea.delete({ where: { id: areaId } });
    return { success: true };
  }

  // ---------- Onboarding (Provider Type Selection + conditional setup) ----------

  // Lightweight fetch for the onboarding endpoints — none of them need the
  // heavy PUBLIC_PROVIDER_INCLUDE join that getByUserId/getPublicProfile
  // use for rendering a full profile.
  //
  // Onboarding is still a single-workspace flow for now (see
  // docs/WORKSPACES.md): this resolves the ONE workspace a user is
  // actively onboarding, and — same as before this project — throws if
  // that's not unambiguous. A user's second-and-later workspaces are
  // created already-complete via WorkspacesService.create, so they never
  // need to pass through here (that's also why this ambiguity can't
  // actually arise in practice yet: nothing creates a second workspace
  // that still needs step-by-step onboarding).
  private async getOwnProviderRow(userId: string) {
    return this.providerContext.resolveForUser(userId);
  }

  // Everything the onboarding UI needs to render the right step and
  // prefill previously-saved answers, so a user can leave and resume later
  // (spec: "Persist onboarding progress so users can leave and resume").
  async getOnboardingState(userId: string) {
    const own = await this.providerContext.resolveForUser(userId);
    const provider = await this.prisma.provider.findUnique({
      where: { id: own.id },
      include: {
        location: true,
        teamMembers: { orderBy: { createdAt: 'asc' } },
        services: { where: { isActive: true }, select: { id: true }, take: 1 },
        user: { select: { phone: true, email: true, avatarUrl: true } },
      },
    });
    if (!provider) throw new NotFoundException('Provider profile not found');

    return {
      providerType: provider.providerType,
      onboardingStep: provider.onboardingStep,
      onboardingCompletedAt: provider.onboardingCompletedAt,
      businessName: provider.businessName,
      description: provider.description,
      bio: provider.bio,
      phone: provider.phone,
      registrationNumber: provider.registrationNumber,
      representativeName: provider.representativeName,
      teamSize: provider.teamSize,
      logoUrl: provider.logoUrl,
      location: provider.location,
      hasActiveOffering: provider.services.length > 0,
      teamMembers: provider.teamMembers,
      // So the frontend doesn't re-ask for contact info already collected
      // at registration (spec: "Avoid asking for information already
      // collected during authentication").
      accountPhone: provider.user.phone,
      accountEmail: provider.user.email,
      accountAvatarUrl: provider.user.avatarUrl,
    };
  }

  // Step 1. Idempotent: re-selecting the SAME type never moves the step
  // backward. Selecting a DIFFERENT type after already entering
  // type-specific details (spec: "change their selection before completing
  // onboarding") resets to PROFILE_DETAILS, since fields collected for the
  // old type (e.g. a BUSINESS registrationNumber) don't apply to the new
  // one — nothing is deleted, it's just no longer authoritative until
  // profile_details is redone.
  async selectProviderType(userId: string, dto: SelectProviderTypeDto) {
    const provider = await this.getOwnProviderRow(userId);

    const isFirstSelection = provider.onboardingStep === 'TYPE_SELECTION';
    const isChangingType = !isFirstSelection && provider.providerType !== dto.providerType;
    // Advance past type_selection the first time through; if the user
    // comes back later and picks a DIFFERENT type, drop back to
    // profile_details (the old type's answers no longer apply) rather
    // than staying wherever they'd already gotten to.
    const nextStep: ProviderOnboardingStep =
      isFirstSelection || isChangingType ? 'PROFILE_DETAILS' : provider.onboardingStep;

    // Two writes, one transaction — see applyOnboardingChange for why the
    // workspace row is updated alongside the provider row.
    return this.applyOnboardingChange(provider, {
      providerType: dto.providerType,
      onboardingStep: nextStep,
    });
  }

  // Provider and Workspace each carry an onboarding step and a type, and
  // they are the same facts about the same thing — but they are separate rows
  // that used to be written independently, which let them drift:
  //
  //  - AuthService.register creates the workspace with a hardcoded
  //    INDIVIDUAL type (the real type isn't known until the type-selection
  //    step) and never touches its onboardingStep.
  //  - Each onboarding step advanced only the provider row.
  //
  // So a user who picked TEAM and got as far as profile_details still had a
  // workspace saying INDIVIDUAL / TYPE_SELECTION — which is what the workspace
  // switcher renders. Routing every onboarding write through here keeps both
  // rows identical in one transaction, so they can't half-apply.
  private async applyOnboardingChange(
    provider: { id: string; workspaceId: string },
    data: Prisma.ProviderUpdateInput,
  ) {
    const workspaceData: Prisma.WorkspaceUpdateInput = {};
    // Provider.providerType is nullable and can also arrive as a Prisma field
    // operation ({ set: ... }); Workspace.type is neither. Only a concrete
    // value is mirrored, so a null/operation never leaks into the workspace.
    const providerType =
      typeof data.providerType === 'string' ? data.providerType : data.providerType?.set ?? undefined;
    if (providerType) workspaceData.type = providerType;
    if (data.onboardingStep) workspaceData.onboardingStep = data.onboardingStep;
    if (data.onboardingCompletedAt) workspaceData.onboardingCompletedAt = data.onboardingCompletedAt;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.provider.update({ where: { id: provider.id }, data });
      await tx.workspace.update({ where: { id: provider.workspaceId }, data: workspaceData });
      return updated;
    });
  }

  // Step 2. Requiredness depends on the TYPE ALREADY STORED for this
  // provider — never on anything the client claims about its own type in
  // this same request — so a client can't, say, submit BUSINESS-shaped
  // validation while actually being registered as INDIVIDUAL (spec:
  // "Validate all inputs on the backend, not just the frontend").
  async updateOnboardingProfile(userId: string, dto: UpdateOnboardingProfileDto) {
    const provider = await this.getOwnProviderRow(userId);
    if (!provider.providerType) {
      throw new BadRequestException('Choose a provider type before completing your profile');
    }

    const nextBusinessName = dto.businessName?.trim() ?? provider.businessName;
    if (!nextBusinessName) {
      throw new BadRequestException(
        provider.providerType === 'INDIVIDUAL' ? 'Full name is required' : 'Name is required',
      );
    }
    if (
      (provider.providerType === 'BUSINESS' || provider.providerType === 'AGENCY') &&
      !(dto.representativeName?.trim() ?? provider.representativeName)
    ) {
      throw new BadRequestException('Authorized representative name is required');
    }

    const shouldAdvance = provider.onboardingStep === 'PROFILE_DETAILS';
    return this.applyOnboardingChange(provider, {
      businessName: nextBusinessName,
      bio: dto.bio ?? provider.bio,
      phone: dto.phone ?? provider.phone,
      registrationNumber: dto.registrationNumber ?? provider.registrationNumber,
      representativeName: dto.representativeName ?? provider.representativeName,
      teamSize: dto.teamSize ?? provider.teamSize,
      logoUrl: dto.logoUrl ?? provider.logoUrl,
      ...(shouldAdvance ? { onboardingStep: 'SERVICES_SETUP' as ProviderOnboardingStep } : {}),
    });
  }

  // Step 3 -> completed. Gates what "Prevent incomplete provider profiles
  // from being published publicly" actually means: a location and at
  // least one active, sellable offering. Verification is deliberately NOT
  // required here — it's an independent, ongoing workflow (the existing
  // verification module), not a gate on finishing onboarding.
  async completeOnboarding(userId: string) {
    const provider = await this.getOwnProviderRow(userId);
    if (!provider.providerType) {
      throw new BadRequestException('Choose a provider type before finishing setup');
    }
    if (provider.onboardingStep === 'COMPLETED') {
      return provider; // idempotent
    }
    if (!provider.locationId) {
      throw new BadRequestException('Set your service location before finishing setup');
    }
    const offeringCount = await this.prisma.serviceOffering.count({
      where: { providerId: provider.id, isActive: true },
    });
    if (offeringCount === 0) {
      throw new BadRequestException('Add at least one service before finishing setup');
    }

    return this.applyOnboardingChange(provider, {
      onboardingStep: 'COMPLETED',
      onboardingCompletedAt: new Date(),
    });
  }

  // --- Team roster (TEAM members / AGENCY-managed providers) ---

  async listTeamMembers(userId: string) {
    const provider = await this.getOwnProviderRow(userId);
    return this.prisma.providerTeamMember.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addTeamMember(userId: string, dto: AddTeamMemberDto) {
    const provider = await this.getOwnProviderRow(userId);
    if (!provider.providerType || !TYPES_WITH_TEAM_ROSTER.includes(provider.providerType)) {
      throw new BadRequestException('Only team and agency profiles can add team members');
    }
    if (!dto.name && !dto.email && !dto.phone) {
      throw new BadRequestException('Provide at least a name, email, or phone number for this team member');
    }
    // AGENCY only: this roster IS the "managed providers" entitlement
    // (spec §7). For TEAM, this same roster predates the workspace
    // Members system (see docs/WORKSPACES.md) and isn't plan-limited —
    // capping it here would also wrongly block TEAM's legacy add-member
    // flow, since 'managedProviders' resolves to a hard 0 for any
    // non-AGENCY type.
    if (provider.providerType === 'AGENCY') {
      await this.entitlements.assertCanAdd(provider, 'managedProviders');
    }
    return this.prisma.providerTeamMember.create({
      data: { providerId: provider.id, ...dto },
    });
  }

  async removeTeamMember(userId: string, memberId: string) {
    const provider = await this.getOwnProviderRow(userId);
    const member = await this.prisma.providerTeamMember.findUnique({ where: { id: memberId } });
    if (!member || member.providerId !== provider.id) throw new NotFoundException('Team member not found');
    await this.prisma.providerTeamMember.delete({ where: { id: memberId } });
    return { success: true };
  }

}
