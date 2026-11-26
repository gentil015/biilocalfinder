import { apiRequest } from '../client';
import type { AuthTokens } from '@/src/types/api';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'CLIENT' | 'PROVIDER';
  termsAccepted: true;
  termsVersion: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export const authApi = {
  register: (dto: RegisterDto) =>
    apiRequest<AuthTokens>('/auth/register', { method: 'POST', body: JSON.stringify(dto), auth: false }),

  login: (dto: LoginDto) =>
    apiRequest<AuthTokens>('/auth/login', { method: 'POST', body: JSON.stringify(dto), auth: false }),

  logout: (refreshToken: string) =>
    apiRequest<null>('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),

  requestPasswordReset: (email: string) =>
    apiRequest<null>('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
      auth: false,
    }),

  resetPassword: (token: string, newPassword: string) =>
    apiRequest<null>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
      auth: false,
    }),

  requestContactCode: (channel: 'EMAIL' | 'PHONE') =>
    apiRequest<null>('/verification/contact/request', {
      method: 'POST',
      body: JSON.stringify({ channel }),
    }),

  confirmContactCode: (channel: 'EMAIL' | 'PHONE', code: string) =>
    apiRequest<null>('/verification/contact/confirm', {
      method: 'POST',
      body: JSON.stringify({ channel, code }),
    }),
};
