import type { ApiErrorBody } from '@/src/types/api';

export type ApiErrorKind = 'network' | 'timeout' | 'auth' | 'validation' | 'server' | 'client' | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = classifyKind(status, details);
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON responses (e.g. proxy errors) still produce a usable error.
    }
    const details = Array.isArray(body.message) ? body.message : undefined;
    const rawMessage = details?.join(', ') || (typeof body.message === 'string' ? body.message : '');
    const requestId = typeof body.requestId === 'string' ? body.requestId : response.headers.get('x-request-id') ?? undefined;
    return new ApiError(
      response.status,
      safeClientMessage(response.status, rawMessage),
      details,
      requestId,
    );
  }
}

function classifyKind(status: number, details?: string[]): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 408) return 'timeout';
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 422 || (details && details.length > 0)) return 'validation';
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  return 'unknown';
}

function safeClientMessage(status: number, rawMessage: string): string {
  if (status >= 500) return friendlyStatus(status);
  const msg = rawMessage?.trim();
  if (!msg) return friendlyStatus(status);
  // Never surface internal-looking messages to end users.
  if (/prisma|sql|stack|exception|timeout exceeded|internal/i.test(msg)) {
    return friendlyStatus(status);
  }
  return msg;
}

export function friendlyStatus(status: number): string {
  if (status === 0) return 'Cannot reach the server. Check your connection and try again.';
  if (status === 400) return 'Please check your input and try again.';
  if (status === 401) return 'Your email or password is incorrect.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 408) return 'The request timed out. Please try again.';
  if (status === 409) return 'That conflicts with the current state. Please refresh and try again.';
  if (status === 413) return 'That file is too large. Try a smaller one.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Service temporarily unavailable. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return new ApiError(408, friendlyStatus(408));
    if (/network request failed|failed to fetch/i.test(error.message)) {
      return new ApiError(0, friendlyStatus(0));
    }
  }
  return new ApiError(0, friendlyStatus(0));
}
