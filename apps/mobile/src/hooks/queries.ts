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
  reviewSummary: (id: string) => ['provider', id, 'reviews', 'summary'] as const,
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

function useWorkspaceScopedKey(key: readonly unknown[]) {
  const workspaceId = useAppStore((state) => state.activeWorkspaceId);
  return [...key, workspaceId ?? null] as const;
}

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

export function useReviewSummary(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reviewSummary(id ?? ''),
    queryFn: () => discoveryApi.reviewSummary(id!),
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
  const queryKey = useWorkspaceScopedKey(queryKeys.myRequests);
  return useQuery({ queryKey, queryFn: () => requestsApi.mine() });
}

export function useIncomingRequests() {
  const queryKey = useWorkspaceScopedKey(queryKeys.incomingRequests);
  return useQuery({ queryKey, queryFn: () => requestsApi.incoming() });
}

export function useRequest(id: string | undefined) {
  const queryKey = useWorkspaceScopedKey(queryKeys.request(id ?? ''));
  return useQuery({
    queryKey,
    queryFn: () => requestsApi.detail(id!),
    enabled: Boolean(id),
  });
}

export function useQuotes(requestId: string | undefined) {
  const queryKey = useWorkspaceScopedKey(queryKeys.quotes(requestId ?? ''));
  return useQuery({
    queryKey,
    queryFn: () => requestsApi.quotes(requestId!),
    enabled: Boolean(requestId),
  });
}

export function useBookings(provider = false) {
  const queryKey = useWorkspaceScopedKey(queryKeys.bookings(provider));
  return useQuery({
    queryKey,
    queryFn: () => (provider ? requestsApi.providerBookings() : requestsApi.myBookings()),
  });
}

export function useNotifications() {
  const queryKey = useWorkspaceScopedKey(queryKeys.notifications);
  return useQuery({ queryKey, queryFn: () => notificationsApi.list() });
}

export function useNotificationPreferences() {
  const queryKey = useWorkspaceScopedKey(queryKeys.preferences);
  return useQuery({ queryKey, queryFn: () => notificationsApi.preferences() });
}

export function useConversations() {
  const queryKey = useWorkspaceScopedKey(queryKeys.conversations);
  return useQuery({ queryKey, queryFn: () => messagingApi.conversations() });
}

export function useMessages(id: string | undefined) {
  const queryKey = useWorkspaceScopedKey(queryKeys.messages(id ?? ''));
  return useQuery({
    queryKey,
    queryFn: () => messagingApi.messages(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useProviderProfile() {
  const queryKey = useWorkspaceScopedKey(queryKeys.providerProfile);
  return useQuery({ queryKey, queryFn: () => providerApi.profile() });
}

export function useOfferings() {
  const queryKey = useWorkspaceScopedKey(queryKeys.offerings);
  return useQuery({ queryKey, queryFn: () => providerApi.offerings() });
}

export function useOnboarding() {
  const queryKey = useWorkspaceScopedKey(queryKeys.onboarding);
  return useQuery({ queryKey, queryFn: () => providerApi.onboarding() });
}

export function useAvailability() {
  const queryKey = useWorkspaceScopedKey(queryKeys.availability);
  return useQuery({ queryKey, queryFn: () => providerApi.availability() });
}

export function useVerification() {
  const queryKey = useWorkspaceScopedKey(queryKeys.verification);
  return useQuery({ queryKey, queryFn: () => providerApi.verification() });
}

export function useProviderAnalytics() {
  const queryKey = useWorkspaceScopedKey(queryKeys.analytics);
  return useQuery({ queryKey, queryFn: () => providerApi.analytics() });
}

export function useInboxReviews() {
  const queryKey = useWorkspaceScopedKey(queryKeys.inboxReviews);
  return useQuery({ queryKey, queryFn: () => providerApi.inboxReviews() });
}

export function useAuthWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces, queryFn: () => workspacesApi.list() });
}
