import { apiRequest } from '../client';

export interface PickedFile {
  uri: string;
  name?: string | null;
  type?: string | null;
}

function toForm(file: PickedFile): FormData {
  const form = new FormData();
  form.append('file', {
    uri: file.uri,
    name: file.name ?? file.uri.split('/').pop() ?? 'upload.jpg',
    type: file.type ?? 'image/jpeg',
  } as unknown as Blob);
  return form;
}

export const filesApi = {
  uploadImage: (file: PickedFile) =>
    apiRequest<{ key: string; url: string }>('/files/upload', {
      method: 'POST',
      body: toForm(file),
      timeoutMs: 120_000,
    }),
  uploadVideo: (file: PickedFile) =>
    apiRequest<{ key: string; url: string }>('/files/upload-video', {
      method: 'POST',
      body: toForm(file),
      timeoutMs: 180_000,
    }),
  uploadVerificationDocument: (file: PickedFile) =>
    apiRequest<{ storageKey: string; mimeType: string; sizeBytes: number; originalName: string }>(
      '/provider/verification/documents',
      { method: 'POST', body: toForm(file), timeoutMs: 120_000 },
    ),
  uploadQuoteAttachment: (file: PickedFile) =>
    apiRequest<{ storageKey: string; url: string; fileName: string; mimeType: string }>('/quotes/attachments', {
      method: 'POST',
      body: toForm(file),
      timeoutMs: 120_000,
    }),
  uploadReviewPhoto: (file: PickedFile) =>
    apiRequest<{ storageKey: string; url: string }>('/reviews/photos', {
      method: 'POST',
      body: toForm(file),
      timeoutMs: 120_000,
    }),
  uploadMessageAttachment: (conversationId: string, file: PickedFile) =>
    apiRequest<{ storageKey: string; url: string; mimeType: string; sizeBytes: number }>(
      `/conversations/${conversationId}/attachments`,
      { method: 'POST', body: toForm(file), timeoutMs: 180_000 },
    ),
};
