import { apiRequest } from '../client';
import type { ChatMessage, ConversationItem } from '@/src/types/api';

export const messagingApi = {
  conversations: () => apiRequest<ConversationItem[]>('/conversations'),
  conversation: (id: string) => apiRequest<ConversationItem>(`/conversations/${id}`),
  messages: (id: string) => apiRequest<ChatMessage[]>(`/conversations/${id}/messages`),
  createConversation: (providerId: string, body?: string) =>
    apiRequest<ConversationItem & { created: boolean; message?: ChatMessage }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ providerId, ...(body ? { body } : {}) }),
    }),
  sendMessage: (id: string, body: string, attachments?: Array<{ storageKey: string }>) =>
    apiRequest<ChatMessage>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, ...(attachments?.length ? { attachments } : {}) }),
    }),
  markRead: (id: string) => apiRequest<{ success: boolean }>(`/conversations/${id}/read`, { method: 'PATCH' }),
};
