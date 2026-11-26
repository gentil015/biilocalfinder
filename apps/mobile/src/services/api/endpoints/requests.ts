import { apiRequest } from '../client';
import type {
  BookingItem,
  QuoteItem,
  QuoteRevision,
  ServiceRequestItem,
} from '@/src/types/api';

export interface CreateServiceRequestDto {
  serviceId: string;
  providerId?: string;
  isPublic?: boolean;
  title: string;
  description: string;
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
  create: (dto: CreateServiceRequestDto) =>
    apiRequest<ServiceRequestItem>('/service-requests', { method: 'POST', body: JSON.stringify(dto) }),
  mine: () => apiRequest<ServiceRequestItem[]>('/service-requests/mine'),
  incoming: () => apiRequest<ServiceRequestItem[]>('/service-requests/incoming'),
  detail: (id: string) => apiRequest<ServiceRequestItem>(`/service-requests/${id}`),
  updatePrivacy: (id: string, isPublic: boolean) =>
    apiRequest<ServiceRequestItem>(`/service-requests/${id}/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublic }),
    }),
  cancel: (id: string) => apiRequest<ServiceRequestItem>(`/service-requests/${id}`, { method: 'DELETE' }),

  quotes: (requestId: string) => apiRequest<QuoteItem[]>(`/service-requests/${requestId}/quotes`),
  createQuote: (dto: CreateQuoteDto) =>
    apiRequest<QuoteItem>('/quotes', { method: 'POST', body: JSON.stringify(dto) }),
  acceptQuote: (id: string) => apiRequest<BookingItem>(`/quotes/${id}/accept`, { method: 'POST' }),
  rejectQuote: (id: string) => apiRequest<QuoteItem>(`/quotes/${id}/reject`, { method: 'POST' }),
  createRevision: (id: string, price: number, message?: string) =>
    apiRequest<QuoteRevision>(`/quotes/${id}/revisions`, {
      method: 'POST',
      body: JSON.stringify({ price, ...(message ? { message } : {}) }),
    }),
  acceptRevision: (id: string) => apiRequest<QuoteRevision>(`/quote-revisions/${id}/accept`, { method: 'POST' }),
  rejectRevision: (id: string) => apiRequest<QuoteRevision>(`/quote-revisions/${id}/reject`, { method: 'POST' }),

  myBookings: () => apiRequest<BookingItem[]>('/bookings/mine'),
  providerBookings: () => apiRequest<BookingItem[]>('/bookings/provider/mine'),
  booking: (id: string) => apiRequest<BookingItem>(`/bookings/${id}`),
  updateBookingStatus: (id: string, status: string, note?: string) =>
    apiRequest<BookingItem>(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    }),
  bookingReview: (id: string) => apiRequest<{ review: unknown; canReview: boolean; reviewDeadline: string | null }>(`/bookings/${id}/review`),
  createReview: (id: string, dto: CreateReviewDto) =>
    apiRequest<unknown>(`/bookings/${id}/reviews`, { method: 'POST', body: JSON.stringify(dto) }),
};
