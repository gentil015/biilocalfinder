import { apiRequest } from '../client';
import { normalizeBooking, normalizeServiceRequest } from '../normalizers';
import type {
  BookingItem,
  QuoteItem,
  QuoteRevision,
  ServiceRequestItem,
} from '@/src/types/api';

export interface CreateServiceRequestDto {
  serviceId?: string;
  providerId?: string;
  isPublic?: boolean;
  title?: string;
  description?: string;
  preferredDate: string;
  preferredTime?: string;
  budgetMin?: number;
  budgetMax?: number;
  additionalNotes?: string;
  serviceOfferingId?: string;
  attributeValues?: Record<string, unknown>;
  locationId?: string;
  images?: string[];
}

export interface CreateQuoteDto {
  requestId: string;
  price: number;
  estimatedDuration?: string;
  proposedDate?: string;
  description?: string;
  materials?: string;
  includedItems?: string[];
  excludedItems?: string[];
  expiresAt?: string;
  attachments?: Array<{ storageKey: string; fileName?: string }>;
}

export interface CreateReviewDto {
  rating: number;
  qualityRating?: number;
  communicationRating?: number;
  professionalismRating?: number;
  valueRating?: number;
  comment?: string;
  photoKeys?: string[];
}

export const requestsApi = {
  create: async (dto: CreateServiceRequestDto) =>
    normalizeServiceRequest(await apiRequest<ServiceRequestItem>('/service-requests', { method: 'POST', body: JSON.stringify(dto) })),
  mine: async () => (await apiRequest<ServiceRequestItem[]>('/service-requests/mine')).map(normalizeServiceRequest),
  incoming: async () => (await apiRequest<ServiceRequestItem[]>('/service-requests/incoming')).map(normalizeServiceRequest),
  detail: async (id: string) => normalizeServiceRequest(await apiRequest<ServiceRequestItem>(`/service-requests/${id}`)),
  updatePrivacy: async (id: string, isPublic: boolean) =>
    normalizeServiceRequest(await apiRequest<ServiceRequestItem>(`/service-requests/${id}/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    })),
  cancel: async (id: string) => normalizeServiceRequest(await apiRequest<ServiceRequestItem>(`/service-requests/${id}`, { method: 'DELETE' })),

  quotes: (requestId: string) => apiRequest<QuoteItem[]>(`/service-requests/${requestId}/quotes`),
  createQuote: (dto: CreateQuoteDto) =>
    apiRequest<QuoteItem>('/quotes', { method: 'POST', body: JSON.stringify(dto) }),
  acceptQuote: async (id: string) => normalizeBooking(await apiRequest<BookingItem>(`/quotes/${id}/accept`, { method: 'POST' })),
  rejectQuote: (id: string) => apiRequest<QuoteItem>(`/quotes/${id}/reject`, { method: 'POST' }),
  createRevision: (id: string, price: number, message?: string, proposedDate?: string, estimatedDuration?: string) =>
    apiRequest<QuoteRevision>(`/quotes/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify({
        price,
        ...(message ? { message } : {}),
        ...(proposedDate ? { proposedDate } : {}),
        ...(estimatedDuration ? { estimatedDuration } : {}),
      }),
    }),
  acceptRevision: (id: string) => apiRequest<QuoteRevision>(`/quote-revisions/${id}/accept`, { method: 'POST' }),
  rejectRevision: (id: string) => apiRequest<QuoteRevision>(`/quote-revisions/${id}/reject`, { method: 'POST' }),

  myBookings: async () => (await apiRequest<BookingItem[]>('/bookings/mine')).map(normalizeBooking),
  providerBookings: async () => (await apiRequest<BookingItem[]>('/bookings/provider/mine')).map(normalizeBooking),
  booking: async (id: string) => normalizeBooking(await apiRequest<BookingItem>(`/bookings/${id}`)),
  updateBookingStatus: async (id: string, status: string, note?: string) =>
    normalizeBooking(await apiRequest<BookingItem>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    })),
  bookingReview: (id: string) => apiRequest<{ review: unknown; canReview: boolean; reviewDeadline: string | null }>(`/bookings/${id}/review`),
  createReview: (id: string, dto: CreateReviewDto) =>
    apiRequest<unknown>(`/bookings/${id}/reviews`, { method: 'POST', body: JSON.stringify(dto) }),
};
