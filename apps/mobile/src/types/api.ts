export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';
export type ProviderType = 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';
export type WorkspaceRole = 'OWNER' | 'MANAGER' | 'MEMBER';
export type VerificationStatus =
  | 'UNVERIFIED'
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'EXPIRED';
export type ServiceRequestStatus =
  | 'OPEN'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'BOOKED'
  | 'CANCELLED'
  | 'EXPIRED';
export type QuoteStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
export type BookingStatus =
  | 'REQUESTED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';
export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phone?: string | null;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  locale: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  type: ProviderType;
  status: string;
  role?: WorkspaceRole;
  membershipStatus?: string;
}

export interface AvailabilitySummary {
  paused: boolean;
  availableToday: boolean;
  availableTomorrow: boolean;
  nextAvailableDate: string | null;
  nextAvailableLabel: string;
  todayHours?: string | null;
}

export interface ProviderSearchItem {
  id: string;
  businessName: string;
  avatarUrl: string | null;
  description?: string | null;
  bio?: string | null;
  rating: number;
  reviewCount: number;
  verifiedReviewCount?: number;
  verificationStatus: VerificationStatus;
  availabilityStatus: AvailabilityStatus;
  availability?: AvailabilitySummary | null;
  yearsOfExperience: number;
  distanceKm: number | null;
  servesArea?: boolean | null;
  startingPrice: number | null;
  currency: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  icon?: string | null;
  isActive: boolean;
  children?: Category[];
}

export interface ServiceItem {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
}

export interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export interface ServiceWithCategory extends ServiceItem {
  category?: Category | null;
  basePrice?: number | null;
  currency?: string;
  durationMinutes?: number | null;
}

export interface ProviderExperience {
  id: string;
  title?: string | null;
  company?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  position?: number | null;
}

export interface ProviderEducation {
  id: string;
  school?: string | null;
  degree?: string | null;
  fieldOfStudy?: string | null;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  position?: number | null;
}

export interface ProviderPortfolioImage {
  id: string;
  storageKey?: string | null;
  url?: string | null;
  caption?: string | null;
  position?: number | null;
}

export interface ProviderPortfolio {
  id: string;
  title?: string | null;
  description?: string | null;
  projectDate?: string | null;
  isBeforeAfter?: boolean;
  serviceId?: string | null;
  service?: { id: string; name: string } | null;
  images?: ProviderPortfolioImage[];
}

export interface ReviewSummary {
  total: number;
  average: number | null;
  distribution?: Record<string, number>;
  verifiedCount?: number;
  withPhotosCount?: number;
  subratings?: Record<string, number | null>;
}

export interface ProviderDetail extends ProviderSearchItem {
  businessName: string;
  logoUrl?: string | null;
  website?: string | null;
  city?: string | null;
  addressLine?: string | null;
  yearsOfExperience: number;
  serviceRadiusKm?: number | null;
  completedJobCount?: number;
  responseRateSummary?: { percentage: number; answeredRequests: number; totalRequests: number } | null;
  reputationMetrics?: Record<string, unknown>;
  serviceOfferings?: OfferingItem[];
  services?: OfferingItem[];
  experiences?: ProviderExperience[];
  educations?: ProviderEducation[];
  portfolios?: ProviderPortfolio[];
  reviews?: ReviewItem[];
  reviewSummary?: ReviewSummary | null;
  serviceAreas?: Array<{ id: string; label: string; latitude: number; longitude: number; radiusKm: number }>;
  location?: { label?: string | null; city?: string | null; addressLine?: string | null; latitude: number; longitude: number } | null;
  availability?: AvailabilitySummary | null;
  servesQueriedLocation?: boolean | null;
  score?: number;
  businessVerified?: boolean;
  providerType?: ProviderType | null;
  onboardingStep?: ProviderOnboardingStep | null;
  onboardingCompletedAt?: string | null;
  verificationStatus: VerificationStatus;
  subscriptionStatus?: SubscriptionStatus | null;
}

export type ProviderOnboardingStep = 'TYPE_SELECTION' | 'PROFILE_DETAILS' | 'SERVICES_SETUP' | 'VERIFICATION' | 'COMPLETED';
export type SubscriptionStatus = 'INACTIVE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface ProviderOnboarding {
  providerType?: ProviderType | null;
  onboardingStep?: ProviderOnboardingStep | null;
  onboardingCompletedAt?: string | null;
  businessName?: string | null;
  description?: string | null;
  bio?: string | null;
  phone?: string | null;
  registrationNumber?: string | null;
  representativeName?: string | null;
  teamSize?: number | null;
  logoUrl?: string | null;
  location?: ProviderDetail['location'];
  hasActiveOffering?: boolean;
  teamMembers?: Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null; role?: string | null }>;
  accountPhone?: string | null;
  accountEmail?: string | null;
  accountAvatarUrl?: string | null;
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  qualityRating?: number | null;
  communicationRating?: number | null;
  professionalismRating?: number | null;
  valueRating?: number | null;
  reviewer: { name: string; avatarUrl: string | null };
  response?: { text: string; createdAt: string } | null;
  photos?: Array<{ url?: string; storageKey?: string }>;
  isVerified?: boolean;
  images?: Array<{ url?: string; storageKey?: string }>;
  providerResponse?: { text: string; createdAt: string } | null;
  verifiedBooking?: boolean;
  respondedAt?: string | null;
  status?: string;
  providerId?: string | null;
  bookingId?: string | null;
}

export interface QuoteItem {
  id: string;
  requestId: string;
  providerId: string;
  price: number;
  currency?: string;
  status: QuoteStatus;
  description?: string | null;
  estimatedDuration?: string | number | null;
  proposedDate?: string | null;
  materials?: string | null;
  includedItems?: string[];
  excludedItems?: string[];
  expiresAt?: string | null;
  createdAt: string;
  attachments?: Array<{ storageKey: string; fileName?: string; url?: string }>;
  provider?: { id: string; businessName?: string; avatarUrl?: string | null; rating?: number; reviewCount?: number } | null;
  revisions?: QuoteRevision[];
}

export interface QuoteRevision {
  id: string;
  quoteId: string;
  price: number;
  message?: string | null;
  proposedDate?: string | null;
  estimatedDuration?: string | null;
  status: string;
  createdAt: string;
}

export interface ServiceRequestItem {
  id: string;
  clientId: string;
  serviceId: string;
  providerId?: string | null;
  isPublic: boolean;
  title: string;
  description: string;
  status: ServiceRequestStatus;
  preferredDate: string;
  preferredTime?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  additionalNotes?: string | null;
  serviceOfferingId?: string | null;
  locationId?: string | null;
  images?: string[];
  attributeValues?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  service?: { id: string; name: string } | null;
  provider?: { id: string; businessName?: string; avatarUrl?: string | null } | null;
  client?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string | null } | null;
  quotes?: QuoteItem[];
  assignedTo?: { id: string; firstName?: string; lastName?: string } | null;
  assignedMembership?: { id: string; user?: { id: string; firstName?: string; lastName?: string } | null } | null;
  serviceOffering?: OfferingItem | null;
  location?: { id: string; label?: string | null; city?: string | null } | null;
  attributeSnapshots?: Array<{ name?: string; label?: string; value?: unknown }>;
  booking?: BookingItem | null;
}

export interface BookingStatusEvent {
  status: BookingStatus | string;
  note?: string | null;
  createdAt: string;
  changedBy?: string | null;
}

export interface BookingItem {
  id: string;
  requestId: string;
  serviceRequestId?: string;
  quoteId: string;
  clientId: string;
  providerId: string;
  status: BookingStatus;
  agreedPrice: number;
  currency?: string;
  scheduledAt?: string | null;
  note?: string | null;
  paymentArrangementNote?: string | null;
  statusHistory?: BookingStatusEvent[];
  assignedMembership?: { id: string; user?: { id: string; firstName?: string; lastName?: string } | null } | null;
  createdAt: string;
  request?: { id: string; title: string } | null;
  serviceRequest?: { id: string; title: string } | null;
  provider?: { id: string; businessName?: string; avatarUrl?: string | null } | null;
  client?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string | null } | null;
  viewerRole?: 'CLIENT' | 'PROVIDER';
  contact?: { phone?: string | null; email?: string | null } | null;
}

export interface ConversationItem {
  id: string;
  providerId?: string | null;
  clientId?: string | null;
  serviceRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
  participants?: Array<{ id: string; firstName?: string; lastName?: string; avatarUrl?: string | null; role?: string }>;
  lastMessage?: ChatMessage | null;
  serviceRequest?: { id: string; title: string } | null;
  provider?: { id: string; businessName?: string; avatarUrl?: string | null } | null;
  unreadCount?: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body?: string | null;
  createdAt: string;
  sender?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string | null };
  attachments?: Array<{ storageKey: string; url?: string; mimeType?: string; fileName?: string }>;
}

export interface OfferingImage {
  id: string;
  url: string;
  storageKey?: string;
  position?: number;
}

export interface OfferingItem {
  id: string;
  serviceId: string;
  title?: string | null;
  description?: string | null;
  basePrice?: number | null;
  currency?: string | null;
  priceType?: string;
  duration?: string | number | null;
  availabilityNote?: string | null;
  isActive: boolean;
  images?: OfferingImage[];
  attributeValues?: Record<string, unknown> | Array<Record<string, unknown>>;
  service?: { id: string; name: string; category?: { id: string; name: string } | null } | null;
}

export interface WorkspaceDetails extends WorkspaceSummary {
  provider?: { id: string; businessName?: string; logoUrl?: string | null; verificationStatus?: VerificationStatus };
  permissions?: string[];
  role?: WorkspaceRole;
  invitations?: unknown[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  category: string;
  label?: string;
  description?: string;
  inApp: boolean;
  push: boolean;
  email: boolean;
}

export interface SelectedLocation {
  label: string;
  latitude: number;
  longitude: number;
  city?: string;
  addressLine?: string;
}
