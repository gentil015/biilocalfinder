import { apiRequest, toQueryString } from '../client';
import { normalizeProvider, normalizeReview, normalizeReviewSummary } from '../normalizers';
import type {
  Category,
  NotificationItem,
  Paginated,
  ProviderDetail,
  ReviewItem,
  ReviewSummary,
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
  searchProviders: async (params: ProviderSearchParams) => {
    const result = await apiRequest<Paginated<ProviderDetail>>(`/search/providers${toQueryString({ ...params })}`);
    return { ...result, items: result.items.map(normalizeProvider) };
  },
  provider: async (id: string, location?: { lat?: number; lng?: number }) =>
    normalizeProvider(await apiRequest<ProviderDetail>(`/providers/${id}${location ? toQueryString(location) : ''}`)),
  providerContact: (id: string) =>
    apiRequest<{ phone?: string | null; email?: string | null }>(`/providers/${id}/contact`),
  providerReviews: async (
    id: string,
    params: { page?: number; limit?: number; sort?: string; verifiedOnly?: boolean; withPhotos?: boolean } = {},
  ) => {
    const result = await apiRequest<Paginated<ReviewItem>>(`/providers/${id}/reviews${toQueryString(params)}`);
    return { ...result, items: result.items.map(normalizeReview) };
  },
  reviewSummary: async (id: string): Promise<ReviewSummary | null> =>
    normalizeReviewSummary(await apiRequest<ReviewSummary>(`/providers/${id}/reviews/summary`)),
  favorites: async () => {
    const rows = await apiRequest<Array<ProviderDetail | { provider?: ProviderDetail | null }>>('/favorites');
    return rows.map((row) => (row && 'provider' in row && row.provider ? row.provider : row)).map((provider) => normalizeProvider(provider as ProviderDetail));
  },
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
