import { apiRequest } from '../client';
import type { AuthUser } from '@/src/types/api';

export interface UpdateMeDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface ClientProfile {
  bio?: string | null;
  user: AuthUser;
}

export const clientsApi = {
  me: () => apiRequest<ClientProfile>('/clients/me'),
  update: (dto: { bio?: string; firstName?: string; lastName?: string; avatarUrl?: string }) =>
    apiRequest<ClientProfile>('/clients/me', { method: 'PATCH', body: JSON.stringify(dto) }),
};

export const usersApi = {
  me: () => apiRequest<AuthUser>('/users/me'),

  updateMe: (dto: UpdateMeDto) =>
    apiRequest<AuthUser>('/users/me', { method: 'PATCH', body: JSON.stringify(dto) }),

  updateLocale: (locale: string) =>
    apiRequest<AuthUser>('/users/me/locale', { method: 'PATCH', body: JSON.stringify({ locale }) }),

  requestExport: () => apiRequest<unknown>('/users/me/export'),

  deleteAccount: (password: string) =>
    apiRequest<null>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
};
