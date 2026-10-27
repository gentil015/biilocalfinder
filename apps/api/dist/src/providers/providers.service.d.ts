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
export declare class ProvidersService {
    private prisma;
    private notifications;
    private availability;
    private interactions;
    private entitlements;
    private providerContext;
    constructor(prisma: PrismaService, notifications: NotificationsService, availability: AvailabilityService, interactions: InteractionService, entitlements: EntitlementsService, providerContext: ProviderContextService);
    getByUserId(userId: string): Promise<any>;
    getPublicProfile(id: string, viewerUserId?: string, coords?: {
        lat: number;
        lng: number;
    }): Promise<any>;
    compare(ids: string[]): Promise<{
        id: any;
        businessName: any;
        avatarUrl: any;
        city: any;
        rating: number;
        reviewCount: any;
        verifiedReviewCount: any;
        yearsOfExperience: any;
        responseTimeMinutes: any;
        verificationStatus: any;
        businessVerified: any;
        startingPrice: number;
        currency: any;
        availability: import("../availability/availability-summary").AvailabilitySummary;
    }[]>;
    updateProfile(userId: string, dto: UpdateProviderProfileDto): Promise<any>;
    setLocation(userId: string, dto: SetLocationDto): Promise<any>;
    addServiceArea(userId: string, dto: AddServiceAreaDto): Promise<any>;
    removeServiceArea(userId: string, areaId: string): Promise<{
        success: boolean;
    }>;
    private getOwnProviderRow;
    getOnboardingState(userId: string): Promise<{
        providerType: any;
        onboardingStep: any;
        onboardingCompletedAt: any;
        businessName: any;
        description: any;
        bio: any;
        phone: any;
        registrationNumber: any;
        representativeName: any;
        teamSize: any;
        logoUrl: any;
        location: any;
        hasActiveOffering: boolean;
        teamMembers: any;
        accountPhone: any;
        accountEmail: any;
        accountAvatarUrl: any;
    }>;
    selectProviderType(userId: string, dto: SelectProviderTypeDto): Promise<any>;
    private applyOnboardingChange;
    updateOnboardingProfile(userId: string, dto: UpdateOnboardingProfileDto): Promise<any>;
    completeOnboarding(userId: string): Promise<any>;
    listTeamMembers(userId: string): Promise<any>;
    addTeamMember(userId: string, dto: AddTeamMemberDto): Promise<any>;
    removeTeamMember(userId: string, memberId: string): Promise<{
        success: boolean;
    }>;
}
