const VERCEL_API_URL = 'https://biilocalfinder.vercel.app';

// Server components run without `window`, so a client-only fallback sent their
// fetches to http://localhost:4000 in production — which made every
// server-rendered provider profile 404. Apply the fallback on the server too
// (an explicitly configured NEXT_PUBLIC_API_URL always wins).
const onVercel =
  !!process.env.VERCEL ||
  (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'));

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || (onVercel ? VERCEL_API_URL : 'http://localhost:4000');

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const SESSION_HINT_KEY = 'bii_session';
const CSRF_TOKEN_KEY = 'bii_csrf';
const WORKSPACE_ID_KEY = 'bii_workspace';
const WORKSPACE_ROLE_KEY = 'bii_workspace_role';

// Actual credentials live in HttpOnly cookies set by the API. This flag is
// only a client-side hint so the UI can render the signed-in shell without a
// blocking round-trip; authorization is always decided by the cookie.
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SESSION_HINT_KEY) === '1';
}

export function getSessionHint(): boolean {
  return isLoggedIn();
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(WORKSPACE_ID_KEY);
}

export function getActiveWorkspaceRole(): WorkspaceMemberRole | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem(WORKSPACE_ROLE_KEY);
  return role === 'OWNER' || role === 'MANAGER' || role === 'MEMBER' ? role : null;
}

export function setActiveWorkspace(workspaceId: string, role?: WorkspaceMemberRole) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
  if (role) localStorage.setItem(WORKSPACE_ROLE_KEY, role);
}

export function clearActiveWorkspace() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(WORKSPACE_ID_KEY);
  localStorage.removeItem(WORKSPACE_ROLE_KEY);
}

function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CSRF_TOKEN_KEY);
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = getCsrfToken();
  if (existing) return existing;
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/csrf`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    if (data?.csrfToken) {
      localStorage.setItem(CSRF_TOKEN_KEY, data.csrfToken);
      return data.csrfToken;
    }
  } catch {
    // Network failure just means no CSRF header; the API will reject an
    // unsafe cookie-authenticated request with a clear 403.
  }
  return null;
}

export function setSession(session: AuthTokens) {
  if (typeof window === 'undefined') return;
  if (session.csrfToken) localStorage.setItem(CSRF_TOKEN_KEY, session.csrfToken);
  localStorage.setItem(SESSION_HINT_KEY, '1');
}

// Kept for callers that used the old token-store API.
export function setTokens(tokens: AuthTokens) {
  setSession(tokens);
}

// The server clears the cookies on logout. Clear the local hint even if that
// request failed, so the UI cannot remain stuck in a signed-in shell.
export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_HINT_KEY);
  localStorage.removeItem(CSRF_TOKEN_KEY);
  clearActiveWorkspace();
}

// A single in-flight refresh shared by every 401 that lands while it runs,
// so a page firing several authenticated requests doesn't burn through the
// rotation chain (the API revokes each refresh token on use — see
// AuthService.refresh — and a second use of the same one would 401).
let refreshInFlight: Promise<AuthTokens> | null = null;

async function refreshTokens(): Promise<AuthTokens> {
  if (!isLoggedIn()) throw new ApiError('Not authenticated', 401);
  if (!refreshInFlight) {
    refreshInFlight = request<AuthTokens>('/auth/refresh', { method: 'POST' })
      .then((tokens) => {
        setSession(tokens);
        return tokens;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// Bounce a dead session to /login. Crucially, never reload when we are
// already on /login: the login form calls this path while resolving the new
// session, and a hard reload there wiped the form and any error message, so a
// failed sign-in looked like the button did nothing.
function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const current = window.location.pathname + window.location.search;
  if (window.location.pathname === '/login') return;
  window.location.href = `/login${current ? `?next=${encodeURIComponent(current)}` : ''}`;
}

async function request<T>(path: string, init?: RequestInit, auth = false): Promise<T> {
  // FormData sets its own multipart boundary — never force JSON on it.
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const method = (init?.method ?? 'GET').toUpperCase();
  const safeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const csrfExempt = /^\/auth\/(login|register|password-reset\/request|password-reset\/confirm)$/.test(path);
  const csrfToken = !safeMethod && !csrfExempt ? await ensureCsrfToken() : null;

  const send = (): Promise<Response> =>
    fetch(`${API_URL}/api${path}`, {
      ...init,
      // Send and receive the HttpOnly session cookies. This is also the only
      // credential transport now: no access/refresh token ever touches JS.
      credentials: 'include',
      // Always read live data. Without this, server components (e.g. the
      // public provider page) get Next's Data Cache, which can serve a
      // stale response — so a logo/profile change wouldn't show up.
      cache: 'no-store',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(init?.headers ?? {}),
      },
    });

  let res = await send();

  // Access tokens are short-lived (15m by default). On expiry, rotate once
  // and replay the original request rather than bouncing the user to /login.
  // Only retried for authenticated calls, and never for the refresh call
  // itself (that would recurse).
  if (auth && res.status === 401 && !path.startsWith('/auth/refresh')) {
    if (isLoggedIn()) {
      try {
        await refreshTokens();
        res = await send();
      } catch {
        clearTokens();
        redirectToLogin();
      }
    } else {
      clearTokens();
      redirectToLogin();
    }
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      redirectToLogin();
    }
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body.message === 'string'
        ? body.message
        : Array.isArray(body.message)
          ? body.message.join(', ')
          : 'Something went wrong';
    throw new ApiError(message, res.status);
  }

  // NestJS serialises a `null` return value (and any `void` handler) as an
  // empty body with a 2xx status — `GET /subscriptions/current` does exactly
  // that when the provider has no subscription. `Response.json()` throws on
  // an empty body, so read the text first and map empty → null.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// Authenticated convenience wrapper — attaches the active workspace header
// used by the API to resolve the actor's workspace role and provider scope.
function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const workspaceId = getActiveWorkspaceId();
  if (!workspaceId) return request<T>(path, init, true);
  return request<T>(
    path,
    {
      ...init,
      headers: {
        'x-workspace-id': workspaceId,
        ...(init?.headers ?? {}),
      },
    },
    true,
  );
}

export interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
  csrfToken?: string;
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
  verificationStatus: string;
  businessVerified?: boolean;
  availability?: {
    paused: boolean;
    availableToday: boolean;
    availableTomorrow: boolean;
    nextAvailableDate: string | null;
    nextAvailableLabel: string;
  } | null;
  availabilityStatus: string;
  yearsOfExperience: number;
  responseTimeMinutes: number | null;
  distanceKm: number | null;
  servesArea?: boolean | null;
  startingPrice: number | null;
  currency: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ProviderSearchResponse {
  items: ProviderSearchItem[];
  total: number;
  page: number;
  limit: number;
}

export const searchApi = {
  // `attributes` is the one nested param: attribute filters travel as
  // attributes[slug]=value (see below); everything else is flat.
  providers: (params: Record<string, string | number | boolean | Record<string, string> | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      // Nested attribute filters → attributes[slug]=value, the shape
      // SearchProvidersDto validates (Nest parses it back into an object).
      if (k === 'attributes' && v && typeof v === 'object') {
        Object.entries(v as Record<string, string>).forEach(([slug, val]) => qs.set(`attributes[${slug}]`, val));
        return;
      }
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<ProviderSearchResponse>(`/search/providers?${qs.toString()}`);
  },
};

export const adminCategoriesApi = {
  listFlat: () => request<any[]>('/categories?flat=true'),
  attributesForAdmin: (categoryId: string) => authRequest<any[]>(`/categories/${categoryId}/attributes/admin`),
  createAttribute: (categoryId: string, data: Record<string, unknown>) =>
    authRequest<any>(`/categories/${categoryId}/attributes`, { method: 'POST', body: JSON.stringify(data) }),
  updateAttribute: (attributeId: string, data: Record<string, unknown>) =>
    authRequest<any>(`/categories/attributes/${attributeId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeAttribute: (attributeId: string) =>
    authRequest<any>(`/categories/attributes/${attributeId}`, { method: 'DELETE' }),
  reorderAttributes: (categoryId: string, attributeIds: string[]) =>
    authRequest<any[]>(`/categories/${categoryId}/attributes/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ attributeIds }),
    }),
};

export const categoriesApi = {
  tree: () => request<any[]>('/categories'),
  attributes: (categoryId: string) => request<any[]>(`/categories/${categoryId}/attributes`),
};

export const offeringsApi = {
  create: (data: {
    serviceId: string;
    title?: string;
    description?: string;
    basePrice?: number;
    priceType?: string;
    duration?: string;
    attributeValues?: Record<string, unknown>;
  }) => authRequest<any>('/provider/service-offerings', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => authRequest<any[]>('/provider/service-offerings'),
  getOne: (id: string) => authRequest<any>(`/provider/service-offerings/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    authRequest<any>(`/provider/service-offerings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => authRequest<any>(`/provider/service-offerings/${id}`, { method: 'DELETE' }),
  getPublic: (id: string) => request<any>(`/service-offerings/${id}`, undefined, true),
};

export interface AdminDashboardStats {
  totalUsers: number;
  totalProviders: number;
  verifiedProviders: number;
  activeSubscriptions: number;
  activeBookings: number;
  completedBookings: number;
  newServiceRequestsLast7Days: number;
  openReports: number;
  openDisputes: number;
  pendingProviderApplications: number;
}

export interface AdminUser {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'PENDING_VERIFICATION';
  createdAt: string;
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface AdminAuditLogsPage {
  items: AdminAuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminSubscription {
  id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING';
  startDate: string;
  renewalDate: string | null;
  endDate: string | null;
  createdAt: string;
  provider: {
    id: string;
    businessName: string;
    providerType: ProviderType | null;
    subscriptionStatus: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAST_DUE' | 'TRIALING';
    user: { firstName: string; lastName: string; email: string };
  };
  plan: {
    id: string;
    name: string;
    workspaceType: ProviderType;
    price: string | number;
    currency: string;
    billingInterval: 'MONTHLY' | 'YEARLY';
  };
  transactions: {
    id: string;
    amount: string | number;
    currency: string;
    paymentProvider: string;
    paymentStatus: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
    createdAt: string;
  }[];
}

export interface AdminSubscriptionsPage {
  items: AdminSubscription[];
  total: number;
  page: number;
  limit: number;
  stats: {
    active: number;
    pastDue: number;
    expiringSoon: number;
    billingIssues: number;
  };
}

export const adminApi = {
  dashboard: () => authRequest<AdminDashboardStats>('/admin/dashboard'),
  users: (params: { search?: string; role?: AdminUser['role']; status?: AdminUser['status']; page?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    return authRequest<AdminUsersPage>(`/admin/users?${query.toString()}`);
  },
  setUserStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    authRequest<AdminUser>(`/admin/users/${id}/${status === 'SUSPENDED' ? 'suspend' : 'activate'}`, {
      method: 'PATCH',
    }),
  auditLogs: (params: { search?: string; action?: string; entity?: string; page?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.action) query.set('action', params.action);
    if (params.entity) query.set('entity', params.entity);
    if (params.page) query.set('page', String(params.page));
    return authRequest<AdminAuditLogsPage>(`/admin/audit-logs?${query.toString()}`);
  },
  subscriptions: (params: {
    search?: string;
    status?: AdminSubscription['status'];
    providerType?: ProviderType;
    billingIssues?: boolean;
    page?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.providerType) query.set('providerType', params.providerType);
    if (params.billingIssues) query.set('billingIssues', 'true');
    if (params.page) query.set('page', String(params.page));
    return authRequest<AdminSubscriptionsPage>(`/admin/subscriptions?${query.toString()}`);
  },
};

/**
 * "Become a provider": a client applies from their existing account and an
 * admin approves, which upgrades THAT account in place. Deliberately not a
 * link to /register — that path creates a second user row and strands the
 * applicant's request history on the old one.
 */
export const providerApplicationsApi = {
  submit: (data: {
    providerType: 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';
    businessName: string;
    description?: string;
    phone?: string;
    yearsOfExperience?: number;
    registrationNumber?: string;
    idNumber?: string;
    websiteUrl?: string;
    categories?: string[];
  }) => authRequest<any>('/provider-applications', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => authRequest<any[]>('/provider-applications/mine'),
};

export const adminProviderApplicationsApi = {
  list: (status?: 'PENDING' | 'APPROVED' | 'REJECTED') =>
    authRequest<any[]>(`/admin/provider-applications${status ? `?status=${status}` : ''}`),
  getOne: (id: string) => authRequest<any>(`/admin/provider-applications/${id}`),
  approve: (id: string, note?: string) =>
    authRequest<any>(`/admin/provider-applications/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  reject: (id: string, reason: string) =>
    authRequest<any>(`/admin/provider-applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
};

export const adminPersonalizationApi = {
  getWeights: () => authRequest<Record<string, number>>('/personalization/admin/ranking-weights'),
  updateWeights: (weights: Record<string, number>) =>
    authRequest<Record<string, number>>('/personalization/admin/ranking-weights', {
      method: 'PATCH',
      body: JSON.stringify(weights),
    }),
};

export const providerInsightsApi = {
  get: () =>
    authRequest<{
      recommendedActions: { action: string; label: string }[];
      opportunities: any[];
      profileStrength: { percent: number; checklist: { id: string; label: string; checked: boolean }[] };
    }>('/personalization/provider-insights'),
};

export interface ProviderAnalyticsSummary {
  periodLabel: string;
  profileViews: number;
  serviceViews: number;
  requests: number;
  quotesSent: number;
  bookings: number;
  conversionRate: number;
  topSearchedService: { serviceId: string; serviceName: string; count: number } | null;
  mostViewedService: { serviceOfferingId: string; serviceName: string; count: number } | null;
}

export const providerAnalyticsApi = {
  get: () => authRequest<ProviderAnalyticsSummary>('/personalization/provider-analytics'),
};

export const portfolioApi = {
  mine: () => authRequest<any[]>('/providers/me/portfolios'),
  create: (data: { title: string; description?: string; serviceId?: string; projectDate?: string }) =>
    authRequest<any>('/providers/me/portfolios', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    authRequest<any>(`/providers/me/portfolios/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => authRequest<any>(`/providers/me/portfolios/${id}`, { method: 'DELETE' }),
  addImage: (
    portfolioId: string,
    data: {
      url: string;
      storageKey: string;
      mediaType?: 'IMAGE' | 'VIDEO';
      beforeAfterRole?: 'BEFORE' | 'AFTER';
      beforeAfterGroup?: string;
    },
  ) => authRequest<any>(`/providers/me/portfolios/${portfolioId}/images`, { method: 'POST', body: JSON.stringify(data) }),
  removeImage: (imageId: string) =>
    authRequest<any>(`/providers/me/portfolios/images/${imageId}`, { method: 'DELETE' }),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload', { method: 'POST', body: form });
  },
  uploadVideo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload-video', { method: 'POST', body: form });
  },
};

export const personalizationApi = {
  home: (lat?: number, lng?: number) => {
    const qs = new URLSearchParams();
    if (lat != null) qs.set('lat', String(lat));
    if (lng != null) qs.set('lng', String(lng));
    return authRequest<any>(`/personalization/home?${qs.toString()}`);
  },
  providers: (params: { serviceId?: string; categoryId?: string; lat?: number; lng?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return authRequest<any[]>(`/personalization/providers?${qs.toString()}`);
  },
  services: () => authRequest<any[]>('/personalization/services'),
  interests: () => authRequest<any[]>('/personalization/interests'),
  getPreferences: () => authRequest<any>('/personalization/preferences'),
  updatePreferences: (data: Record<string, unknown>) =>
    authRequest<any>('/personalization/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
};

export const interactionsApi = {
  // Fire-and-forget from the frontend for pure navigation events with no
  // natural backend hook (e.g. a search query). Most interactions are
  // recorded automatically server-side instead.
  record: (data: { type: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> }) =>
    authRequest<void>('/personalization/interactions', { method: 'POST', body: JSON.stringify(data) }).catch(
      () => undefined, // best-effort — never let a tracking call break the UI
    ),
};

export const usersApi = {
  me: () =>
    authRequest<{
      id: string;
      email: string;
      phone?: string | null;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
      role: 'CLIENT' | 'PROVIDER' | 'ADMIN';
      status: string;
      emailVerified: boolean;
      phoneVerified: boolean;
      locale: string;
    }>('/users/me'),
  updateMe: (data: {
    phone?: string | null;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }) =>
    authRequest<any>('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  // Returns the updated user, same shape as `me`, so the caller can update its
  // session copy without a second request.
  updateLocale: (locale: string) =>
    authRequest<{ locale: string }>('/users/me/locale', {
      method: 'PATCH',
      body: JSON.stringify({ locale }),
    }),
  exportMe: () => authRequest<any>('/users/me/export'),
  deleteMe: (password: string) =>
    authRequest<{ success: boolean }>('/users/me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};

export interface ClientProfile {
  id: string;
  userId: string;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    phone: string | null;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

// A client's own profile (spec §3). Mirrors ClientsController 1:1 — GET/PATCH
// /clients/me, CLIENT role only. `updateMe` sends only the fields it means to
// change so a partial save can never blank a field the caller didn't touch.
export const clientsApi = {
  getMe: () => authRequest<ClientProfile>('/clients/me'),
  updateMe: (data: { firstName?: string; lastName?: string; bio?: string; avatarUrl?: string }) =>
    authRequest<ClientProfile>('/clients/me', { method: 'PATCH', body: JSON.stringify(data) }),
  // Reuses the general upload endpoint every other image uses (portfolio,
  // review photos) — no client-specific upload path.
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload', { method: 'POST', body: form });
  },
};

export const providersApi = {
  // Uses request's optional-auth mode: OptionalJwtAuthGuard records a
  // VIEW_PROVIDER interaction server-side when the viewer is logged in
  // (spec §7 profile views), but the route stays public either way.
  // Passing coords adds distanceKm / servesQueriedLocation to the response
  // (spec §12 "Serves your area").
  getPublic: (id: string, coords?: { lat: number; lng: number }) =>
    request<any>(`/providers/${id}${coords ? `?lat=${coords.lat}&lng=${coords.lng}` : ''}`, undefined, true),
  compare: (ids: string[]) => request<any[]>(`/providers/compare?ids=${ids.join(',')}`),
  getMe: () => authRequest<any>('/providers/me/profile'),
  updateMe: (data: {
    businessName?: string;
    description?: string;
    bio?: string;
    phone?: string;
    yearsOfExperience?: number;
    serviceRadiusKm?: number;
    availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';
    logoUrl?: string;
  }) => authRequest<any>('/providers/me/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload', { method: 'POST', body: form, headers: {} as any });
  },
  setLocation: (data: { latitude: number; longitude: number; addressLine?: string; city?: string; label?: string }) =>
    authRequest<any>('/providers/me/location', { method: 'PATCH', body: JSON.stringify(data) }),
  addServiceArea: (data: { label: string; latitude: number; longitude: number; radiusKm: number }) =>
    authRequest<any>('/providers/me/service-areas', { method: 'POST', body: JSON.stringify(data) }),
  removeServiceArea: (id: string) => authRequest<any>(`/providers/me/service-areas/${id}`, { method: 'DELETE' }),
};

export type WorkspaceType = 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';
export type WorkspaceMemberRole = 'OWNER' | 'MANAGER' | 'MEMBER';
export type WorkspaceMemberStatus = 'INVITED' | 'ACTIVE' | 'REMOVED';

export interface WorkspaceProviderSummary {
  id: string;
  businessName: string;
  logoUrl: string | null;
  verificationStatus: string;
  subscriptionStatus: string;
  availabilityStatus: string;
  rating: number;
  reviewCount: number;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  provider: WorkspaceProviderSummary | null;
}

export interface WorkspaceMembershipSummary {
  membershipId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  joinedAt: string | null;
  workspace: Workspace;
}

export interface WorkspaceMember {
  id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  invitedEmail: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; avatarUrl: string | null };
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceMemberRole;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy?: { id: string; firstName: string; lastName: string; email: string };
}

export interface WorkspaceInvitationPreview {
  workspace: { id: string; name: string; type: WorkspaceType };
  email: string;
  role: WorkspaceMemberRole;
  inviterName: string;
  expiresAt: string;
}

export interface WorkspaceAuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; firstName: string; lastName: string; email: string } | null;
}

// The workspace switcher's data source (spec §1/§6) plus per-workspace
// membership management. Mirrors the backend's WorkspacesModule 1:1 — see
// apps/api/src/workspaces.
export const workspacesApi = {
  listMine: () => authRequest<WorkspaceMembershipSummary[]>('/workspaces'),
  getContext: (workspaceId: string) =>
    authRequest<Workspace & { memberships: { id: string; userId: string; role: WorkspaceMemberRole }[] }>(
      `/workspaces/${workspaceId}`,
    ),
  update: (workspaceId: string, data: { name?: string }) =>
    authRequest<Workspace>(`/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listMembers: (workspaceId: string) => authRequest<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
  inviteMember: (workspaceId: string, data: { email: string; role: 'MANAGER' | 'MEMBER' }) =>
    authRequest<WorkspaceInvitation>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listInvitations: (workspaceId: string) =>
    authRequest<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`),
  revokeInvitation: (workspaceId: string, invitationId: string) =>
    authRequest<{ success: boolean }>(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: 'DELETE' }),
  updateMemberRole: (workspaceId: string, membershipId: string, role: 'MANAGER' | 'MEMBER') =>
    authRequest<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  removeMember: (workspaceId: string, membershipId: string) =>
    authRequest<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}`, { method: 'DELETE' }),
  transferOwnership: (workspaceId: string, membershipId: string) =>
    authRequest<Workspace>(`/workspaces/${workspaceId}/ownership/transfer`, {
      method: 'POST',
      body: JSON.stringify({ membershipId }),
    }),
  acceptInvite: (workspaceId: string, membershipId: string) =>
    authRequest<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}/accept`, { method: 'POST' }),
  listAudit: (workspaceId: string) => authRequest<WorkspaceAuditEntry[]>(`/workspaces/${workspaceId}/audit`),
  assignRequest: (workspaceId: string, requestId: string, membershipId: string | null) =>
    authRequest<unknown>(`/workspaces/${workspaceId}/assignments/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ membershipId }),
    }),
  assignBooking: (workspaceId: string, bookingId: string, membershipId: string | null) =>
    authRequest<unknown>(`/workspaces/${workspaceId}/assignments/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify({ membershipId }),
    }),
  getInvitation: (token: string) =>
    request<WorkspaceInvitationPreview>(`/workspace-invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (token: string) =>
    authRequest<Workspace & { memberships: { id: string; userId: string; role: WorkspaceMemberRole }[] }>(
      `/workspace-invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    ),
};

export interface SubscriptionPlan {
  id: string;
  workspaceType: WorkspaceType;
  name: string;
  price: string | number;
  currency: string;
  billingInterval: 'MONTHLY' | 'YEARLY';
  maxServices: number | null;
  maxPortfolioImages: number | null;
  maxMonthlyRequests: number | null;
  maxTeamMembers: number | null;
  maxManagedProviders: number | null;
  features: Record<string, unknown> | null;
  isActive: boolean;
}

export interface ProviderSubscription {
  id: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'TRIALING' | 'CANCELLED' | 'EXPIRED';
  startDate: string;
  renewalDate: string | null;
  endDate: string | null;
  plan: SubscriptionPlan;
}

export interface EntitlementUsage {
  resource: 'services' | 'portfolioItems' | 'teamMembers' | 'managedProviders';
  label: string;
  used: number;
  limit: number | null;
}

export interface UsageSummary {
  plan: SubscriptionPlan | null;
  resources: EntitlementUsage[];
}

// Type-specific plans + backend-enforced entitlements (spec §7). Mirrors
// SubscriptionsService/EntitlementsService — see apps/api/src/subscriptions.
export const subscriptionsApi = {
  listPlans: (workspaceType?: WorkspaceType) =>
    authRequest<SubscriptionPlan[]>(`/subscription/plans${workspaceType ? `?workspaceType=${workspaceType}` : ''}`),
  current: () => authRequest<ProviderSubscription | null>('/subscriptions/current'),
  usage: () => authRequest<UsageSummary>('/subscriptions/usage'),
  subscribe: (planId: string) =>
    authRequest<ProviderSubscription>('/subscriptions', { method: 'POST', body: JSON.stringify({ planId }) }),
  cancel: (subscriptionId: string) =>
    authRequest<ProviderSubscription>(`/subscriptions/${subscriptionId}/cancel`, { method: 'POST' }),
};

export type ProviderType = 'INDIVIDUAL' | 'TEAM' | 'BUSINESS' | 'AGENCY';
export type ProviderOnboardingStep =
  | 'TYPE_SELECTION'
  | 'PROFILE_DETAILS'
  | 'SERVICES_SETUP'
  | 'VERIFICATION'
  | 'COMPLETED';

export interface ProviderOnboardingState {
  providerType: ProviderType | null;
  onboardingStep: ProviderOnboardingStep;
  onboardingCompletedAt: string | null;
  businessName: string;
  description: string | null;
  bio: string | null;
  phone: string | null;
  registrationNumber: string | null;
  representativeName: string | null;
  teamSize: number | null;
  logoUrl: string | null;
  location: { id: string; latitude: number; longitude: number; city: string | null; addressLine: string | null } | null;
  hasActiveOffering: boolean;
  teamMembers: { id: string; name: string | null; email: string | null; phone: string | null; role: string | null }[];
  accountPhone: string | null;
  accountEmail: string;
  accountAvatarUrl: string | null;
}

export const providerOnboardingApi = {
  getState: () => authRequest<ProviderOnboardingState>('/providers/me/onboarding'),
  selectType: (providerType: ProviderType) =>
    authRequest<any>('/providers/me/onboarding/type', { method: 'PATCH', body: JSON.stringify({ providerType }) }),
  updateProfile: (data: {
    businessName?: string;
    bio?: string;
    phone?: string;
    registrationNumber?: string;
    representativeName?: string;
    teamSize?: number;
    logoUrl?: string;
  }) => authRequest<any>('/providers/me/onboarding/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  complete: () => authRequest<any>('/providers/me/onboarding/complete', { method: 'POST' }),
  listTeamMembers: () =>
    authRequest<ProviderOnboardingState['teamMembers']>('/providers/me/onboarding/team-members'),
  addTeamMember: (data: { name?: string; email?: string; phone?: string; role?: string }) =>
    authRequest<any>('/providers/me/onboarding/team-members', { method: 'POST', body: JSON.stringify(data) }),
  removeTeamMember: (id: string) =>
    authRequest<any>(`/providers/me/onboarding/team-members/${id}`, { method: 'DELETE' }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload', { method: 'POST', body: form });
  },
};

export const servicesApi = {
  list: (categoryId?: string) =>
    request<any[]>(`/services${categoryId ? `?categoryId=${categoryId}` : ''}`),
};

export const requestAssistApi = {
  suggest: (data: { serviceId: string; description?: string; imageKey?: string }) =>
    authRequest<{
      title?: string;
      description?: string;
      attributeValues: Record<string, unknown>;
      suggestedCount: number;
      skippedCount: number;
    }>('/request-assist/suggest', { method: 'POST', body: JSON.stringify({ ...data, consentToProcess: true }) }),
  // Reuses the same general upload endpoint portfolio photos use — no new
  // upload path, just a new caller of the existing one.
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ key: string; url: string }>('/files/upload', { method: 'POST', body: form });
  },
};

// The fields the AI booking assistant can pre-fill — mirrors exactly what
// POST /service-requests accepts, so anything it fills flows into the
// existing request form untouched.
export interface BookingAssistFields {
  serviceId?: string;
  title?: string;
  description?: string;
  preferredDate?: string;
  preferredTime?: string;
  budgetMin?: number;
  budgetMax?: number;
  additionalNotes?: string;
  attributeValues?: Record<string, unknown>;
}

export interface BookingAssistResult {
  reply: string;
  language: 'en' | 'rw' | 'fr';
  fields: BookingAssistFields;
  missingFields: ('service' | 'title' | 'description')[];
  questions: string[];
  suggestedCount: number;
  skippedCount: number;
}

export const bookingAssistApi = {
  suggest: (data: {
    message: string;
    history?: { role: 'user' | 'assistant'; text: string }[];
    serviceId?: string;
    filledFields?: ('service' | 'title' | 'description')[];
  }) =>
    authRequest<BookingAssistResult>('/booking-assist/suggest', {
      method: 'POST',
      body: JSON.stringify({ ...data, consentToProcess: true }),
    }),
};

// --- AI natural-language search (POST /search-assist/parse) ----------------
// The backend returns search criteria parsed out of a sentence; every field
// has already been validated against the live catalog there. The `filters`
// shape mirrors GET /search/providers exactly (minus sort, which the client
// controls), so results can be fetched by spreading it into searchApi.

export type SearchChipKey =
  | 'service'
  | 'location'
  | 'urgency'
  | 'budget'
  | 'experience'
  | 'rating'
  | 'verified'
  | 'attribute';

export interface SearchChip {
  key: SearchChipKey;
  /** Pre-formatted for display: budgets/ratings are language-neutral strings;
   *  attribute chips carry the attribute's own database name in `name`. */
  value: string;
  name?: string;
}

export interface ParsedSearchFilters {
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
  sort: 'recommended';
}

export interface ParsedSearchResult {
  reply: string;
  language: 'en' | 'rw' | 'fr';
  filters: ParsedSearchFilters;
  /** Attribute filters keyed by slug — send as attributes[slug]=value. */
  attributes?: Record<string, string>;
  chips: SearchChip[];
  suggestedCount: number;
  skippedCount: number;
}

export const searchAssistApi = {
  // Public endpoint (same surface as GET /search) — no auth header, but the
  // API throttles it per IP since every call fans out to an AI request.
  parse: (data: { message: string; language?: 'en' | 'rw' | 'fr'; lat?: number; lng?: number; radiusKm?: number }) =>
    request<ParsedSearchResult>('/search-assist/parse', {
      method: 'POST',
      body: JSON.stringify({ ...data, consentToProcess: true }),
    }),
};

export const requestsApi = {
  create: (data: {
    serviceId: string;
    providerId?: string;
    serviceOfferingId?: string;
    // Direct requests stay private to the pinned provider; true opens them
    // so other matching providers can also submit competing quotes.
    isPublic?: boolean;
    attributeValues?: Record<string, unknown>;
    title: string;
    description: string;
    preferredDate?: string;
    preferredTime?: string;
    budgetMin?: number;
    budgetMax?: number;
    additionalNotes?: string;
  }) => authRequest<any>('/service-requests', { method: 'POST', body: JSON.stringify(data) }),

  mine: () => authRequest<any[]>('/service-requests/mine'),
  incoming: () => authRequest<any[]>('/service-requests/incoming'),
  getOne: (id: string) => authRequest<any>(`/service-requests/${id}`),
  cancel: (id: string) => authRequest<any>(`/service-requests/${id}`, { method: 'DELETE' }),
  // Client-controlled visibility on a direct request: true opens it to the
  // marketplace, false pulls it back to being private to the pinned provider.
  setPrivacy: (id: string, isPublic: boolean) =>
    authRequest<any>(`/service-requests/${id}/privacy`, { method: 'PATCH', body: JSON.stringify({ isPublic }) }),
};

export const quotesApi = {
  create: (data: {
    requestId: string;
    price: number;
    estimatedDuration?: string;
    proposedDate?: string;
    description?: string;
    materials?: string;
    includedItems?: string[];
    excludedItems?: string[];
    expiresAt?: string;
    attachments?: { storageKey: string; fileName?: string }[];
  }) => authRequest<any>('/quotes', { method: 'POST', body: JSON.stringify(data) }),

  uploadAttachment: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ storageKey: string; url: string; fileName: string; mimeType: string }>('/quotes/attachments', {
      method: 'POST',
      body: form,
      headers: {} as any,
    });
  },

  forRequest: (requestId: string) => authRequest<any[]>(`/service-requests/${requestId}/quotes`),
  accept: (id: string) => authRequest<any>(`/quotes/${id}/accept`, { method: 'POST' }),
  reject: (id: string) => authRequest<any>(`/quotes/${id}/reject`, { method: 'POST' }),
  proposeRevision: (id: string, data: { price: number; message?: string }) =>
    authRequest<any>(`/quotes/${id}/revisions`, { method: 'POST', body: JSON.stringify(data) }),
  acceptRevision: (id: string) => authRequest<any>(`/quote-revisions/${id}/accept`, { method: 'POST' }),
  rejectRevision: (id: string) => authRequest<any>(`/quote-revisions/${id}/reject`, { method: 'POST' }),
};

export const availabilityApi = {
  mine: () => authRequest<any>('/provider/availability'),
  setWeekly: (days: { dayOfWeek: number; startTime: string; endTime: string; isActive?: boolean }[]) =>
    authRequest<any>('/provider/availability/weekly', { method: 'PUT', body: JSON.stringify({ days }) }),
  setStatus: (status: 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE') =>
    authRequest<any>('/provider/availability/status', { method: 'POST', body: JSON.stringify({ status }) }),
  addException: (data: { date: string; isAvailable: boolean; note?: string }) =>
    authRequest<any>('/provider/availability/exceptions', { method: 'POST', body: JSON.stringify(data) }),
  removeException: (id: string) => authRequest<any>(`/provider/availability/exceptions/${id}`, { method: 'DELETE' }),
  forProvider: (providerId: string) => request<any>(`/providers/${providerId}/availability`),
};

export const bookingsApi = {
  mineAsClient: () => authRequest<any[]>('/bookings/mine'),
  mineAsProvider: () => authRequest<any[]>('/bookings/provider/mine'),
  getOne: (id: string) => authRequest<any>(`/bookings/${id}`),
  updateStatus: (id: string, status: string, note?: string) =>
    authRequest<any>(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note }) }),
};

export interface CustomerAssistServiceSuggestion {
  id: string;
  key: string;
  name: string;
  category: string;
  providerCount: number;
}

export interface CustomerAssistProviderSuggestion {
  id: string;
  businessName: string;
  city: string | null;
  rating: number;
  reviewCount: number;
  verified: boolean;
  avatarUrl: string | null;
}

export type CustomerAssistActionKind =
  | 'search'
  | 'become-provider'
  | 'bookings'
  | 'messages'
  | 'saved-searches'
  | 'disputes'
  | 'account';

export interface CustomerAssistAction {
  kind: CustomerAssistActionKind;
  label: string;
  href: string;
}

export interface CustomerAssistResult {
  reply: string;
  language: 'en' | 'rw' | 'fr';
  questions: string[];
  suggestions: {
    services: CustomerAssistServiceSuggestion[];
    providers: CustomerAssistProviderSuggestion[];
  };
  actions: CustomerAssistAction[];
}

/**
 * "Ask BII Assistant" — marketplace navigation via plain-language chat.
 * Public endpoint: guests get the same routing help as members.
 */
export const customerAssistApi = {
  chat: (
    message: string,
    options?: {
      history?: { role: 'user' | 'assistant'; text: string }[];
      language?: string;
    },
  ) =>
    request<CustomerAssistResult>('/customer-assist/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: options?.history,
        language: options?.language,
        consentToProcess: true,
      }),
    }),
};

export const notificationsApi = {
  list: (page = 1) => authRequest<any>(`/notifications?page=${page}`),
  markRead: (id: string) => authRequest<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => authRequest<any>('/notifications/read-all', { method: 'PATCH' }),
  getPreferences: () => authRequest<any[]>('/notifications/preferences'),
  updatePreference: (data: { category: string; inApp: boolean; push: boolean; email: boolean }) =>
    authRequest<any[]>('/notifications/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  getPushPublicKey: () => request<{ publicKey: string | null }>('/notifications/push-public-key'),
  registerPush: (data: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
    authRequest<any>('/notifications/push-subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  removePush: (endpoint: string) =>
    authRequest<any>('/notifications/push-subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
};

export const savedSearchesApi = {
  list: () => authRequest<any[]>('/saved-searches'),
  create: (data: { name: string; serviceId?: string; categoryId?: string; city?: string; verifiedOnly?: boolean; maxPrice?: number }) =>
    authRequest<any>('/saved-searches', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id: string) => authRequest<any>(`/saved-searches/${id}`, { method: 'DELETE' }),
};

export const messagingApi = {
  conversations: () => authRequest<any[]>('/conversations'),
  conversation: (conversationId: string) => authRequest<any>(`/conversations/${conversationId}`),
  /** Direct enquiry — opens or reuses the thread with this provider, no request needed. */
  startConversation: (providerId: string, body?: string) =>
    authRequest<any>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ providerId, ...(body?.trim() ? { body: body.trim() } : {}) }),
    }),
  messages: (conversationId: string) => authRequest<any[]>(`/conversations/${conversationId}/messages`),
  send: (conversationId: string, body: string) =>
    authRequest<any>(`/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  markRead: (conversationId: string) =>
    authRequest<any>(`/conversations/${conversationId}/read`, { method: 'PATCH' }),
};

export const verificationApi = {
  myStatus: () => authRequest<any>('/provider/verification'),
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ storageKey: string; mimeType: string; sizeBytes: number; originalName: string }>(
      '/provider/verification/documents',
      { method: 'POST', body: form, headers: {} as any },
    );
  },
  submit: (data: {
    type: 'IDENTITY' | 'BUSINESS' | 'SERVICE';
    serviceOfferingId?: string;
    legalName?: string;
    referenceNumber?: string;
    note?: string;
    documents: { storageKey: string; documentType: string }[];
  }) => authRequest<any>('/provider/verification', { method: 'POST', body: JSON.stringify(data) }),
};

export const contactVerificationApi = {
  request: (channel: 'EMAIL' | 'PHONE') =>
    authRequest<{ sent: boolean; expiresInMinutes: number }>('/verification/contact/request', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),
  confirm: (channel: 'EMAIL' | 'PHONE', code: string) =>
    authRequest<{ verified: boolean }>('/verification/contact/confirm', {
      method: 'POST',
      body: JSON.stringify({ channel, code }),
    }),
};

export const adminVerificationApi = {
  queue: (params: { status?: string; type?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return authRequest<any>(`/admin/verifications?${qs.toString()}`);
  },
  getOne: (id: string) => authRequest<any>(`/admin/verifications/${id}`),
  approve: (id: string, data: { validityMonths?: number; note?: string } = {}) =>
    authRequest<any>(`/admin/verifications/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  reject: (id: string, reason: string) =>
    authRequest<any>(`/admin/verifications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  suspend: (id: string, reason: string) =>
    authRequest<any>(`/admin/verifications/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }),
  reinstate: (id: string, note?: string) =>
    authRequest<any>(`/admin/verifications/${id}/reinstate`, { method: 'POST', body: JSON.stringify({ note }) }),
};

export const reviewsApi = {
  forProvider: (providerId: string, params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && qs.set(k, String(v)));
    return request<any>(`/providers/${providerId}/reviews?${qs.toString()}`);
  },
  summary: (providerId: string) => request<any>(`/providers/${providerId}/reviews/summary`),
  forBooking: (bookingId: string) => authRequest<any>(`/bookings/${bookingId}/review`),
  create: (
    bookingId: string,
    data: {
      rating: number;
      qualityRating?: number;
      communicationRating?: number;
      professionalismRating?: number;
      valueRating?: number;
      comment?: string;
      photoKeys?: string[];
    },
  ) => authRequest<any>(`/bookings/${bookingId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  uploadPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return authRequest<{ storageKey: string; url: string }>('/reviews/photos', { method: 'POST', body: form, headers: {} as any });
  },
  respond: (reviewId: string, text: string) =>
    authRequest<any>(`/reviews/${reviewId}/response`, { method: 'POST', body: JSON.stringify({ text }) }),
  mine: (params: { unanswered?: boolean; page?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return authRequest<any>(`/provider/reviews?${qs.toString()}`);
  },
};

export const reportsApi = {
  create: (data: { targetType: string; targetId: string; category: string; reason: string; details?: string }) =>
    authRequest<any>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => authRequest<any[]>('/reports/mine'),
};

export const adminReportsApi = {
  list: (params: { status?: string; category?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && qs.set(k, String(v)));
    return authRequest<any>(`/reports?${qs.toString()}`);
  },
  getOne: (id: string) => authRequest<any>(`/reports/${id}`),
  assign: (id: string) => authRequest<any>(`/reports/${id}/assign`, { method: 'PATCH' }),
  resolve: (id: string, data: { resolution?: string; dismiss?: boolean }) =>
    authRequest<any>(`/reports/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const adminReviewsApi = {
  flagged: (page = 1) => authRequest<any>(`/admin/reviews/flagged?page=${page}`),
  hide: (id: string, reason: string) => authRequest<any>(`/admin/reviews/${id}/hide`, { method: 'POST', body: JSON.stringify({ reason }) }),
  restore: (id: string) => authRequest<any>(`/admin/reviews/${id}/restore`, { method: 'POST' }),
};

export const disputesApi = {
  create: (data: { bookingId: string; category: string; reason: string; details?: string }) =>
    authRequest<any>('/disputes', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => authRequest<any[]>('/disputes/mine'),
  getOne: (id: string) => authRequest<any>(`/disputes/${id}`),
  addMessage: (id: string, body: string) =>
    authRequest<any>(`/disputes/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  addEvidence: (id: string, file: File, description?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    return authRequest<any>(`/disputes/${id}/evidence`, { method: 'POST', body: form, headers: {} as any });
  },
};

export const adminDisputesApi = {
  list: (status?: string, page = 1) =>
    authRequest<any>(`/disputes?${status ? `status=${status}&` : ''}page=${page}`),
  review: (id: string) => authRequest<any>(`/disputes/${id}/review`, { method: 'PATCH' }),
  resolve: (id: string, data: { outcome: 'RESOLVED' | 'REJECTED'; resolutionType: string; resolution?: string }) =>
    authRequest<any>(`/disputes/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const favoritesApi = {
  list: () => authRequest<any[]>('/favorites'),
  add: (providerId: string) => authRequest<any>(`/favorites/${providerId}`, { method: 'POST' }),
  remove: (providerId: string) => authRequest<any>(`/favorites/${providerId}`, { method: 'DELETE' }),
};

export const authApi = {
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'CLIENT' | 'PROVIDER';
    phone?: string;
  }) => request<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  // Revokes the refresh token server-side. The API reads it from the HttpOnly
  // cookie; clearing the local session hint is handled by the caller so a
  // failed revoke never leaves the user stuck in a half-signed-out state.
  logout: () => authRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  refresh: () => request<AuthTokens>('/auth/refresh', { method: 'POST' }),

  // Unauthenticated on purpose: the caller has lost their password. The API
  // answers identically for known and unknown addresses, so the UI must not
  // try to infer anything from this response either.
  requestPasswordReset: (email: string) =>
    request<{ success: boolean; message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Consumes the emailed token. Note this does NOT log the user in: the reset
  // revokes their refresh tokens server-side, so they sign in again with the
  // new password.
  resetPassword: (token: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
};
