import type { ApiErrorBody } from '@/src/types/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Non-JSON responses (e.g. proxy errors) still produce a usable error.
    }
    const details = Array.isArray(body.message) ? body.message : undefined;
    const message = details?.join(', ') || (typeof body.message === 'string' ? body.message : '');
    return new ApiError(
      response.status,
      message || friendlyStatus(response.status),
      details,
    );
  }
}

export function friendlyStatus(status: number): string {
  if (status === 0) return 'Cannot reach the server. Check your connection and try again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 409) return 'That conflicts with the current state. Please refresh and try again.';
  if (status === 413) return 'That file is too large. Try a smaller one.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return 'Something went wrong. Please try again.';
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, friendlyStatus(0));
}
