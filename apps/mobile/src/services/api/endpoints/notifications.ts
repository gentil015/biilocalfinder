import { apiRequest } from '../client';
import type { NotificationItem, NotificationPreference } from '@/src/types/api';

export const notificationsApi = {
  list: (page = 1, limit = 30) =>
    apiRequest<{ items: NotificationItem[]; total: number; unreadCount: number; page: number; limit: number }>(
      `/notifications?page=${page}&limit=${limit}`,
    ),
  markRead: (id: string) => apiRequest<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiRequest<{ success: boolean }>('/notifications/read-all', { method: 'PATCH' }),
  preferences: () => apiRequest<NotificationPreference[]>('/notifications/preferences'),
  updatePreference: (dto: NotificationPreference) =>
    apiRequest<NotificationPreference[]>('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(dto),
    }),
};
