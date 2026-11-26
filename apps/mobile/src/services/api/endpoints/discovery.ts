import { apiRequest, toQueryString } from '../client';
import type {
  Category,
  NotificationItem,
  Paginated,
  ProviderDetail,
  ReviewItem,
  ServiceItem,
  ServiceWithCategory,
} from '@/src/types/api';

export interface ProviderSearchParams {
  q?: string;
  serviceId?: string;
  categoryId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  minExperience?: number;
  availableNow?: boolean;
  verifiedOnly?: boolean;
  sort?: string;
  attributes?: Record<string, string>;
  page?: number;
  limit?: number;
}

export interface GeocodeResult {
  label: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
}

export interface PersonalizationHome {
  greeting: string;
  personalizationEnabled: boolean;
  coldStartStage: 'NEW' | 'SOME_ACTIVITY' | 'ESTABLISHED';
  sections: Record<string, unknown>;
}

export const discoveryApi = {
  categories: (flat = false) => apiRequest<Category[]>(`/categories${flat ? '?flat=true' : ''}`),
  categoryAttributes: (id: string) => apiRequest<unknown[]>(`/categories/${id}/attributes`),
  services: (categoryId?: string) =>
    apiRequest<ServiceItem[]>(`/services${categoryId ? toQueryString({ categoryId }) : ''}`),
  service: (id: string) => apiRequest<ServiceWithCategory>(`/services/${id}`),
  searchProviders: (params: ProviderSearchParams) =>
    apiRequest<Paginated<ProviderDetail>>(`/search/providers${toQueryString({ ...params })}`),
  provider: (id: string, location?: { lat?: number; lng?: number }) =>
    apiRequest<ProviderDetail>(`/providers/${id}${location ? toQueryString(location) : ''}`),
  providerContact: (id: string) =>
    apiRequest<{ phone?: string | null; email?: string | null }>(`/providers/${id}/contact`),
  providerReviews: (
    id: string,
    params: { page?: number; limit?: number; sort?: string; verifiedOnly?: boolean; withPhotos?: boolean } = {},
  ) => apiRequest<Paginated<ReviewItem>>(`/providers/${id}/reviews${toQueryString(params)}`),
  reviewSummary: (id: string) => apiRequest<Record<string, unknown>>(`/providers/${id}/reviews/summary`),
  favorites: () => apiRequest<ProviderDetail[]>('/favorites'),
  addFavorite: (providerId: string) => apiRequest<unknown>(`/favorites/${providerId}`, { method: 'POST' }),
  removeFavorite: (providerId: string) => apiRequest<{ success: boolean }>(`/favorites/${providerId}`, { method: 'DELETE' }),
  personalizationHome: (lat?: number, lng?: number) =>
    apiRequest<PersonalizationHome>(`/personalization/home${lat !== undefined && lng !== undefined ? toQueryString({ lat, lng }) : ''}`),
  geocode: (q: string) => apiRequest<GeocodeResult[]>(`/locations/search${toQueryString({ q })}`),
  savedSearches: () => apiRequest<unknown[]>('/saved-searches'),
  saveSearch: (dto: Record<string, unknown>) =>
    apiRequest<unknown>('/saved-searches', { method: 'POST', body: JSON.stringify(dto) }),
  deleteSavedSearch: (id: string) => apiRequest<{ success: boolean }>(`/saved-searches/${id}`, { method: 'DELETE' }),
};

export type { NotificationItem };
