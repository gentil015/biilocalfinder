import { apiRequest } from '../client';
import { normalizeProvider, normalizeReview } from '../normalizers';
import type { OfferingItem, ProviderDetail, ProviderOnboarding, ProviderType, ReviewItem } from '@/src/types/api';

export interface CreateOfferingDto {
  serviceId: string;
  title?: string;
  description?: string;
  basePrice?: number;
  priceType?: string;
  duration?: string;
  attributeValues?: Record<string, unknown>;
}

export interface WeeklyAvailabilityDto {
  days: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }>;
}

export const providerApi = {
  profile: async () => normalizeProvider(await apiRequest<ProviderDetail>('/providers/me/profile')),
  updateProfile: async (dto: Record<string, unknown>) =>
    normalizeProvider(await apiRequest<ProviderDetail>('/providers/me/profile', { method: 'PATCH', body: JSON.stringify(dto) })),
  updateLocation: (dto: { label?: string; addressLine?: string; city?: string; latitude: number; longitude: number }) =>
    apiRequest<ProviderDetail>('/providers/me/location', { method: 'PATCH', body: JSON.stringify(dto) }),
  onboarding: () => apiRequest<ProviderOnboarding>('/providers/me/onboarding'),
  setType: (providerType: ProviderType) =>
    apiRequest<Record<string, unknown>>('/providers/me/onboarding/type', {
      method: 'PATCH',
      body: JSON.stringify({ providerType }),
    }),
  updateOnboardingProfile: (dto: {
    businessName?: string;
    bio?: string;
    phone?: string;
    registrationNumber?: string;
    representativeName?: string;
    teamSize?: number;
    logoUrl?: string;
  }) =>
    apiRequest<Record<string, unknown>>('/providers/me/onboarding/profile', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
  completeOnboarding: () => apiRequest<Record<string, unknown>>('/providers/me/onboarding/complete', { method: 'POST' }),

  offerings: () => apiRequest<OfferingItem[]>('/provider/service-offerings'),
  createOffering: (dto: CreateOfferingDto) =>
    apiRequest<OfferingItem>('/provider/service-offerings', { method: 'POST', body: JSON.stringify(dto) }),
  updateOffering: (id: string, dto: Partial<CreateOfferingDto> & { isActive?: boolean }) =>
    apiRequest<OfferingItem>(`/provider/service-offerings/${id}`, { method: 'PATCH', body: JSON.stringify(dto) }),
  deleteOffering: (id: string) =>
    apiRequest<{ success: boolean }>(`/provider/service-offerings/${id}`, { method: 'DELETE' }),

  availability: () => apiRequest<Record<string, unknown>>('/provider/availability'),
  setAvailabilityStatus: (status: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') =>
    apiRequest<Record<string, unknown>>('/provider/availability/status', {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  setWeeklyAvailability: (dto: WeeklyAvailabilityDto) =>
    apiRequest<Record<string, unknown>>('/provider/availability/weekly', { method: 'PUT', body: JSON.stringify(dto) }),
  addAvailabilityException: (dto: { date: string; isAvailable: boolean; note?: string }) =>
    apiRequest<Record<string, unknown>>('/provider/availability/exceptions', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  deleteAvailabilityException: (id: string) =>
    apiRequest<{ success: boolean }>(`/provider/availability/exceptions/${id}`, { method: 'DELETE' }),

  verification: () => apiRequest<Record<string, unknown>>('/provider/verification'),
  submitVerification: (dto: {
    type: 'IDENTITY' | 'BUSINESS' | 'SERVICE';
    serviceOfferingId?: string;
    legalName?: string;
    referenceNumber?: string;
    note?: string;
    documents: Array<{ storageKey: string; documentType: string }>;
  }) => apiRequest<Record<string, unknown>>('/provider/verification', { method: 'POST', body: JSON.stringify(dto) }),
  analytics: () => apiRequest<Record<string, unknown>>('/personalization/provider-analytics'),
  insights: () => apiRequest<Record<string, unknown>>('/personalization/provider-insights'),
  inboxReviews: async (unanswered = false) => {
    const result = await apiRequest<{ items: ReviewItem[]; total: number; unanswered: number }>(
      `/provider/reviews?unanswered=${unanswered ? 'true' : 'false'}`,
    );
    return { ...result, items: result.items.map(normalizeReview) };
  },
  respondToReview: async (id: string, text: string) =>
    normalizeReview(await apiRequest<ReviewItem>(`/reviews/${id}/response`, { method: 'POST', body: JSON.stringify({ text }) })),
};
