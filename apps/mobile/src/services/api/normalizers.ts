import type {
  AvailabilitySummary,
  BookingItem,
  OfferingItem,
  ProviderDetail,
  ReviewItem,
  ReviewSummary,
  ServiceRequestItem,
} from '@/src/types/api';

type Loose = any;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function normalizeAvailability(value: unknown): AvailabilitySummary | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Loose;
  return {
    paused: source.paused === true,
    availableToday: source.availableToday === true,
    availableTomorrow: source.availableTomorrow === true,
    nextAvailableDate: text(source.nextAvailableDate),
    nextAvailableLabel: text(source.nextAvailableLabel) ?? (source.availableToday ? 'Available today' : 'Availability not available'),
    todayHours: text(source.todayHours),
  };
}

export function normalizeReview(value: Loose): ReviewItem {
  const clientUser = value.client?.user ?? {};
  const reviewerName =
    text(value.reviewer?.name) ??
    ([clientUser.firstName, clientUser.lastName].filter(Boolean).join(' ') || text(value.client?.name)) ??
    'Client';
  const response = value.response ?? value.providerResponse ?? null;
  return {
    ...value,
    rating: Number(value.rating) || 0,
    comment: text(value.comment),
    createdAt: value.createdAt ?? new Date().toISOString(),
    reviewer: {
      name: reviewerName,
      avatarUrl: text(clientUser.avatarUrl) ?? text(value.reviewer?.avatarUrl),
    },
    response: response ? { text: text(response.text) ?? '', createdAt: response.createdAt ?? value.respondedAt ?? value.createdAt } : null,
    photos: (value.photos ?? value.images ?? []).map((photo: Loose) => ({
      url: text(photo.url),
      storageKey: text(photo.storageKey),
    })),
    isVerified: value.isVerified ?? value.verifiedBooking === true,
  };
}

export function normalizeOffering(value: Loose): OfferingItem {
  return {
    ...value,
    id: String(value.id),
    serviceId: String(value.serviceId ?? value.service?.id ?? ''),
    title: text(value.title) ?? text(value.service?.name),
    description: text(value.description),
    basePrice: value.basePrice === null || value.basePrice === undefined ? null : Number(value.basePrice),
    priceType: text(value.priceType),
    duration: value.duration ?? null,
    isActive: value.isActive !== false,
    attributeValues: value.attributeValues && typeof value.attributeValues === 'object' ? value.attributeValues : {},
    service: value.service
      ? {
          id: String(value.service.id),
          name: String(value.service.name ?? ''),
          category: value.service.category
            ? { id: String(value.service.category.id), name: String(value.service.category.name ?? '') }
            : null,
        }
      : null,
  };
}

export function normalizeReviewSummary(value: unknown): ReviewSummary | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Loose;
  return {
    total: Number(source.total ?? source.count ?? 0),
    average: source.average === null || source.average === undefined ? null : Number(source.average),
    distribution: source.distribution && typeof source.distribution === 'object' ? source.distribution : {},
    verifiedCount: Number(source.verifiedCount ?? 0),
    withPhotosCount: Number(source.withPhotosCount ?? 0),
    subratings: source.subratings && typeof source.subratings === 'object' ? source.subratings : {},
  };
}

export function normalizeProvider(value: Loose): ProviderDetail {
  const offerings = (value.serviceOfferings ?? value.services ?? []) as Loose[];
  return {
    ...value,
    serviceOfferings: offerings.map(normalizeOffering),
    services: offerings.map(normalizeOffering),
    reviews: (value.reviews ?? []).map((review: Loose) => normalizeReview(review)),
    reviewSummary: normalizeReviewSummary(value.reviewSummary),
    availability: normalizeAvailability(value.availability),
    logoUrl: text(value.logoUrl),
    serviceRadiusKm: value.serviceRadiusKm === undefined || value.serviceRadiusKm === null ? null : Number(value.serviceRadiusKm),
  };
}

export function normalizeBooking(value: Loose): BookingItem {
  const requestId = text(value.requestId) ?? text(value.serviceRequestId) ?? '';
  return {
    ...value,
    requestId,
    serviceRequestId: text(value.serviceRequestId) ?? requestId,
    request: value.request ?? value.serviceRequest ?? null,
    serviceRequest: value.serviceRequest ?? value.request ?? null,
    note: text(value.note) ?? text(value.paymentArrangementNote),
    paymentArrangementNote: text(value.paymentArrangementNote),
    statusHistory: Array.isArray(value.statusHistory) ? value.statusHistory : [],
  };
}

export function normalizeServiceRequest(value: Loose): ServiceRequestItem {
  const assignedTo = value.assignedTo ?? value.assignedMembership?.user ?? null;
  return {
    ...value,
    assignedTo,
    assignedMembership: value.assignedMembership ?? null,
    serviceOffering: value.serviceOffering ? normalizeOffering(value.serviceOffering) : null,
    attributeSnapshots: Array.isArray(value.attributeSnapshots) ? value.attributeSnapshots : [],
    booking: value.booking ? normalizeBooking(value.booking) : null,
  };
}
