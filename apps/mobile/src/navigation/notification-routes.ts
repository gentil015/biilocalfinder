import type { Href } from 'expo-router';

export interface NotificationRouteInput {
  type?: string | null;
  data?: Record<string, unknown> | null;
}

function stringData(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = data?.[key];
  return typeof value === 'string' && value ? value : null;
}

export function routeForNotification(input: NotificationRouteInput, role?: string): Href | null {
  const data = input.data;
  const savedSearchId = stringData(data, 'savedSearchId');
  if (savedSearchId) return '/saved-searches';
  const conversationId = stringData(data, 'conversationId');
  if (conversationId) return { pathname: '/messages/[id]', params: { id: conversationId } };
  const disputeId = stringData(data, 'disputeId');
  if (disputeId) return { pathname: '/disputes/[id]', params: { id: disputeId } };
  const bookingId = stringData(data, 'bookingId');
  if (bookingId) return { pathname: '/booking/[id]', params: { id: bookingId } };
  const requestId = stringData(data, 'requestId');
  if (requestId) {
    return role === 'PROVIDER'
      ? { pathname: '/provider/request/[id]', params: { id: requestId } }
      : { pathname: '/request/[id]', params: { id: requestId } };
  }
  const providerId = stringData(data, 'providerId');
  if (providerId) return { pathname: '/provider/[id]', params: { id: providerId } };
  const type = input.type ?? stringData(data, 'type') ?? '';
  if (type === 'VERIFICATION_UPDATED' || type === 'VERIFICATION_EXPIRING') return '/verification';
  if (type === 'NEW_REVIEW' || type === 'REVIEW_RESPONSE') return '/reviews';
  return null;
}
