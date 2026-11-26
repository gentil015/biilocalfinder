import { API_TIMEOUT_MS, API_URL } from '@/src/constants/config';
import { useAppStore } from '@/src/stores/app.store';
import { tokenStore } from '@/src/services/storage/token-store';
import { ApiError } from './errors';

export interface ApiRequestOptions extends Omit<RequestInit, 'signal'> {
  auth?: boolean;
  timeoutMs?: number;
}

type UnauthorizedHandler = () => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

async function buildHeaders(options: ApiRequestOptions): Promise<HeadersInit> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (options.auth !== false) {
    const tokens = await tokenStore.read();
    if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }

  const workspaceId = useAppStore.getState().activeWorkspaceId;
  if (workspaceId && !headers.has('x-workspace-id')) headers.set('x-workspace-id', workspaceId);
  return headers;
}

async function refreshAccess(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = await tokenStore.read();
      if (!tokens?.refreshToken) return false;
      try {
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });
        if (!response.ok) return false;
        const data = (await response.json()) as {
          accessToken: string;
          refreshToken: string;
          csrfToken?: string;
        };
        if (!data.accessToken || !data.refreshToken) return false;
        await tokenStore.save(data);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { auth = true, timeoutMs = API_TIMEOUT_MS, ...init } = options;
  const url = `${API_URL}/api${path.startsWith('/') ? path : `/${path}`}`;

  const send = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        headers: await buildHeaders({ ...options, auth }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError(0, 'The request timed out. Check your connection and try again.');
      }
      throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  };

  let response = await send();

  if (response.status === 401 && auth && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshAccess();
    if (refreshed) {
      response = await send();
    } else {
      await tokenStore.clear();
      await unauthorizedHandler?.();
      throw new ApiError(401, 'Your session has expired. Please sign in again.');
    }
  }

  if (!response.ok) throw await ApiError.fromResponse(response);

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (key === 'attributes' && value && typeof value === 'object') {
      Object.entries(value as Record<string, string | number | boolean>).forEach(([slug, attrValue]) => {
        search.set(`attributes[${slug}]`, String(attrValue));
      });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
      return;
    }
    search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : '';
}
