import { useQuery } from '@tanstack/react-query';
import { discoveryApi, type ProviderSearchParams } from '@/src/services/api/endpoints/discovery';
import { messagingApi } from '@/src/services/api/endpoints/messaging';
import { notificationsApi } from '@/src/services/api/endpoints/notifications';
import { providerApi } from '@/src/services/api/endpoints/provider';
import { requestsApi } from '@/src/services/api/endpoints/requests';
import { workspacesApi } from '@/src/services/api/endpoints/workspaces';
import { useAppStore } from '@/src/stores/app.store';

export const queryKeys = {
  categories: ['categories'] as const,
  services: (categoryId?: string) => ['services', categoryId ?? null] as const,
  search: (params: ProviderSearchParams) => ['providers', 'search', params] as const,
  provider: (id: string) => ['provider', id] as const,
  reviews: (id: string) => ['provider', id, 'reviews'] as const,
  personalization: (lat?: number, lng?: number) => ['personalization', lat ?? null, lng ?? null] as const,
  favorites: ['favorites'] as const,
  myRequests: ['requests', 'mine'] as const,
  incomingRequests: ['requests', 'incoming'] as const,
  request: (id: string) => ['requests', id] as const,
  quotes: (requestId: string) => ['quotes', requestId] as const,
  bookings: (provider: boolean) => ['bookings', provider] as const,
  notifications: ['notifications'] as const,
  preferences: ['notification-preferences'] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
  offerings: ['provider', 'offerings'] as const,
  providerProfile: ['provider', 'me'] as const,
  onboarding: ['provider', 'onboarding'] as const,
  availability: ['provider', 'availability'] as const,
  verification: ['provider', 'verification'] as const,
  analytics: ['provider', 'analytics'] as const,
  inboxReviews: ['provider', 'reviews'] as const,
  workspaces: ['workspaces'] as const,
};

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: () => discoveryApi.categories() });
}

export function useServices(categoryId?: string) {
  return useQuery({ queryKey: queryKeys.services(categoryId), queryFn: () => discoveryApi.services(categoryId) });
}

export function useProviderSearch(params: ProviderSearchParams) {
  return useQuery({
    queryKey: queryKeys.search(params),
    queryFn: () => discoveryApi.searchProviders(params),
    placeholderData: (previous) => previous,
  });
}

export function useProvider(id: string | undefined) {
  const selectedLocation = useAppStore((state) => state.selectedLocation);
  const location = selectedLocation?.latitude !== undefined && selectedLocation?.longitude !== undefined
    ? { lat: selectedLocation.latitude, lng: selectedLocation.longitude }
    : undefined;
  return useQuery({
    queryKey: [...queryKeys.provider(id ?? ''), location?.lat ?? null, location?.lng ?? null],
    queryFn: () => discoveryApi.provider(id!, location),
    enabled: Boolean(id),
  });
}

export function useProviderReviews(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews(id ?? ''),
    queryFn: () => discoveryApi.providerReviews(id!),
    enabled: Boolean(id),
  });
}

export function usePersonalization(lat?: number, lng?: number) {
  return useQuery({
    queryKey: queryKeys.personalization(lat, lng),
    queryFn: () => discoveryApi.personalizationHome(lat, lng),
  });
}

export function useFavorites() {
  return useQuery({ queryKey: queryKeys.favorites, queryFn: () => discoveryApi.favorites() });
}

export function useMyRequests() {
  return useQuery({ queryKey: queryKeys.myRequests, queryFn: () => requestsApi.mine() });
}

export function useIncomingRequests() {
  return useQuery({ queryKey: queryKeys.incomingRequests, queryFn: () => requestsApi.incoming() });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.request(id ?? ''),
    queryFn: () => requestsApi.detail(id!),
    enabled: Boolean(id),
  });
}

export function useQuotes(requestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.quotes(requestId ?? ''),
    queryFn: () => requestsApi.quotes(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useBookings(provider = false) {
  return useQuery({
    queryKey: queryKeys.bookings(provider),
    queryFn: () => (provider ? requestsApi.providerBookings() : requestsApi.myBookings()),
  });
}

export function useNotifications() {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => notificationsApi.list() });
}

export function useNotificationPreferences() {
  return useQuery({ queryKey: queryKeys.preferences, queryFn: () => notificationsApi.preferences() });
}

export function useConversations() {
  return useQuery({ queryKey: queryKeys.conversations, queryFn: () => messagingApi.conversations() });
}

export function useMessages(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messages(id ?? ''),
    queryFn: () => messagingApi.messages(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useProviderProfile() {
  return useQuery({ queryKey: queryKeys.providerProfile, queryFn: () => providerApi.profile() });
}

export function useOfferings() {
  return useQuery({ queryKey: queryKeys.offerings, queryFn: () => providerApi.offerings() });
}

export function useOnboarding() {
  return useQuery({ queryKey: queryKeys.onboarding, queryFn: () => providerApi.onboarding() });
}

export function useAvailability() {
  return useQuery({ queryKey: queryKeys.availability, queryFn: () => providerApi.availability() });
}

export function useVerification() {
  return useQuery({ queryKey: queryKeys.verification, queryFn: () => providerApi.verification() });
}

export function useProviderAnalytics() {
  return useQuery({ queryKey: queryKeys.analytics, queryFn: () => providerApi.analytics() });
}

export function useInboxReviews() {
  return useQuery({ queryKey: queryKeys.inboxReviews, queryFn: () => providerApi.inboxReviews() });
}

export function useAuthWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => workspacesApi.list() });
}
