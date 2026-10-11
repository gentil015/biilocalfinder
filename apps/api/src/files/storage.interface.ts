export interface UploadedFileResult {
  key: string;
  url: string;
}

// Every other module (portfolio, service requests, messages, avatars)
// depends only on this interface — never on S3/MinIO directly (spec §20).
// Swapping storage backends means swapping the provider bound to
// STORAGE_SERVICE, not touching any caller.
export interface StorageService {
  upload(buffer: Buffer, originalName: string, mimeType: string, prefix: string): Promise<UploadedFileResult>;
  // Same as upload() but with NO public access — for sensitive files such as
  // identity/business verification documents. Only reachable via
  // getSignedUrl().
  uploadPrivate(buffer: Buffer, originalName: string, mimeType: string, prefix: string): Promise<{ key: string }>;
  // Size + content type of a stored object, or null if it doesn't exist.
  // Lets callers trust what the storage layer saw rather than what a client
  // claims about a file it previously uploaded.
  statObject(key: string): Promise<{ sizeBytes: number; mimeType: string } | null>;
  // Short-lived URL for a private object.
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

// Never trust the client-provided filename/extension for anything other
// than a display hint — validated server-side against this allow-list.
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

// Verification documents additionally allow PDFs (registration certificates,
// licences are commonly scanned to PDF).
export const ALLOWED_DOCUMENT_MIME_TYPES = [...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf'];

// Portfolio videos (spec §6). A separate, larger limit and a separate
// endpoint (POST /files/upload-video) rather than folding into the general
// image upload, so the ordinary image path keeps its small, fast limit.
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB
