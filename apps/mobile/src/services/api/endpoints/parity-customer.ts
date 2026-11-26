import { apiRequest, toQueryString } from '../client';

export const DISPUTE_CATEGORIES = [
  'SERVICE_NOT_AS_DESCRIBED',
  'NO_SHOW',
  'DAMAGE_OR_LOSS',
  'UNPROFESSIONAL_CONDUCT',
  'PAYMENT_DISAGREEMENT',
  'OTHER',
] as const;

export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

export const REPORT_CATEGORIES = [
  'FRAUD_OR_SCAM',
  'FAKE_LISTING',
  'IMPERSONATION',
  'MISLEADING_PRICE',
  'INAPPROPRIATE_CONTENT',
  'HARASSMENT',
  'FAKE_REVIEW',
  'OTHER',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface SavedSearch {
  id: string;
  name: string;
  serviceId?: string | null;
  categoryId?: string | null;
  city?: string | null;
  verifiedOnly?: boolean;
  maxPrice?: number | null;
  service?: { name: string } | null;
  category?: { name: string } | null;
  createdAt?: string;
}

export interface CreateSavedSearchDto {
  name: string;
  serviceId?: string;
  categoryId?: string;
  city?: string;
  verifiedOnly?: boolean;
  maxPrice?: number;
}

export interface CompareProvider {
  id: string;
  businessName: string;
  avatarUrl?: string | null;
  city?: string | null;
  rating: number;
  reviewCount: number;
  verifiedReviewCount?: number | null;
  yearsOfExperience: number;
  completedJobCount: number;
  responseRateSummary?: { percentage: number; answeredRequests: number; totalRequests: number } | null;
  verificationStatus: string;
  businessVerified?: boolean;
  startingPrice?: number | null;
  currency?: string;
  availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
  availability?: { availableToday?: boolean; nextAvailableLabel?: string | null; paused?: boolean } | null;
}

export interface ParsedSearch {
  reply: string;
  language: string;
  filters: {
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
  };
  attributes?: Record<string, string>;
  chips?: Array<{ key: string; value: string; name?: string }>;
  suggestedCount?: number;
  skippedCount?: number;
}

export interface InteractionDto {
  type: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface PersonalizationPreferences {
  userId?: string;
  personalizationEnabled: boolean;
  locationBasedEnabled: boolean;
  recentlyViewedEnabled: boolean;
  preferredCategories?: string[];
  preferredServices?: string[];
  preferredPriceMin?: number | null;
  preferredPriceMax?: number | null;
  preferredSearchRadiusKm?: number | null;
}

export type UpdatePersonalizationPreferencesDto = Partial<PersonalizationPreferences>;

export interface PersonalizationInterest {
  categoryId?: string | null;
  categoryName?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  effectiveScore: number;
}

export interface RequestAssistSuggestion {
  title?: string;
  description?: string;
  attributeValues: Record<string, unknown>;
  suggestedCount?: number;
  skippedCount?: number;
}

export interface BookingAssistSuggestion {
  reply: string;
  language: string;
  fields: Record<string, unknown>;
  missingFields: string[];
  questions: string[];
  suggestedCount?: number;
  skippedCount?: number;
}

export interface AssistTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface CustomerAssistAction {
  kind: string;
  label: string;
  href?: string;
  summary?: string;
  payload?: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export interface CustomerAssistResult {
  reply: string;
  language: string;
  role: string;
  questions: string[];
  suggestions: {
    services: Array<{ id: string; name: string; category: string; providerCount: number; key?: string }>;
    providers: Array<{ id: string; businessName: string; city: string | null; rating: number; reviewCount: number; verified: boolean; avatarUrl: string | null }>;
  };
  actions: CustomerAssistAction[];
}

export interface DisputeMessage {
  id: string;
  body: string;
  createdAt: string;
  author?: { id?: string; firstName?: string; lastName?: string };
}

export interface DisputeEvidence {
  id: string;
  url?: string | null;
  description?: string | null;
  sizeBytes?: number;
  mimeType?: string;
  createdAt?: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  category: DisputeCategory | string;
  reason: string;
  details?: string | null;
  status: 'OPEN' | 'RESPONDED' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED' | string;
  createdAt: string;
  updatedAt?: string;
  resolution?: string | null;
  resolutionType?: string | null;
  messages: DisputeMessage[];
  evidence: DisputeEvidence[];
  booking?: { id: string; request?: { title?: string } | null } | null;
}

export interface CreateDisputeDto {
  bookingId: string;
  category: DisputeCategory;
  reason: string;
  details?: string;
}

export interface ReportItem {
  id: string;
  targetType: string;
  targetId?: string;
  category: string;
  reason: string;
  details?: string | null;
  status: string;
  resolution?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface TrustReport {
  id: string;
  category: ReportCategory | string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reportedUser?: { id: string; firstName: string; lastName: string } | null;
}

export interface CreateReportDto {
  targetType: string;
  targetId: string;
  category: string;
  reason: string;
  details?: string;
}

export interface CreateTrustReportDto {
  category: ReportCategory;
  description: string;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export const parityCustomerApi = {
  savedSearches: () => apiRequest<SavedSearch[]>('/saved-searches'),
  createSavedSearch: (dto: CreateSavedSearchDto) => post<SavedSearch>('/saved-searches', dto),
  deleteSavedSearch: (id: string) => apiRequest<{ success: boolean }>(`/saved-searches/${id}`, { method: 'DELETE' }),
  compareProviders: (ids: string[]) => apiRequest<CompareProvider[]>(`/providers/compare${toQueryString({ ids: ids.join(',') })}`),
  parseSearch: (dto: {
    message: string;
    language?: 'en' | 'rw' | 'fr';
    lat?: number;
    lng?: number;
    radiusKm?: number;
    consentToProcess?: boolean;
  }) => post<ParsedSearch>('/search-assist/parse', { ...dto, consentToProcess: dto.consentToProcess ?? true }),
  recordInteraction: (dto: InteractionDto) => post<unknown>('/personalization/interactions', dto),
  preferences: () => apiRequest<PersonalizationPreferences>('/personalization/preferences'),
  updatePreferences: (dto: UpdatePersonalizationPreferencesDto) =>
    apiRequest<PersonalizationPreferences>('/personalization/preferences', { method: 'PATCH', body: JSON.stringify(dto) }),
  interests: () => apiRequest<PersonalizationInterest[]>('/personalization/interests'),
  suggestRequest: (dto: { serviceId: string; description?: string; imageKey?: string; consentToProcess?: boolean }) =>
    post<RequestAssistSuggestion>('/request-assist/suggest', { ...dto, consentToProcess: dto.consentToProcess ?? true }),
  suggestBooking: (dto: {
    message: string;
    history?: AssistTurn[];
    serviceId?: string;
    filledFields?: string[];
    consentToProcess?: boolean;
  }) => post<BookingAssistSuggestion>('/booking-assist/suggest', { ...dto, consentToProcess: dto.consentToProcess ?? true }),
  customerAssistChat: (dto: { message: string; history?: AssistTurn[]; language?: string; consentToProcess?: boolean }) =>
    post<CustomerAssistResult>('/customer-assist/chat', { ...dto, consentToProcess: dto.consentToProcess ?? true }),
  myDisputes: () => apiRequest<Dispute[]>('/disputes/mine'),
  getDispute: (id: string) => apiRequest<Dispute>(`/disputes/${id}`),
  createDispute: (dto: CreateDisputeDto) => post<Dispute>('/disputes', dto),
  addDisputeMessage: (id: string, body: string) => post<DisputeMessage>(`/disputes/${id}/messages`, { body }),
  addDisputeEvidence: (id: string, file: { uri: string; name: string; type: string }, description?: string) => {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    if (description) form.append('description', description);
    return apiRequest<Dispute>(`/disputes/${id}/evidence`, { method: 'POST', body: form });
  },
  myReports: () => apiRequest<ReportItem[]>('/reports/mine'),
  createReport: (dto: CreateReportDto) => post<ReportItem>('/reports', dto),
  myTrustReports: () => apiRequest<TrustReport[]>('/trust/reports/mine'),
  reportProvider: (providerId: string, dto: CreateTrustReportDto) =>
    post<TrustReport>(`/trust/reports/providers/${encodeURIComponent(providerId)}`, dto),
};
