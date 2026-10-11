import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

/**
 * `HttpException.getResponse()` is a string for `new HttpException('x', 400)`
 * but an object (`{ message, error, statusCode }`) for every built-in
 * exception — `UnauthorizedException`, `BadRequestException`, and so on.
 * Forwarding that object verbatim puts a nested object where clients expect
 * `message` to be a string (or an array of strings, for validation failures),
 * so a real "Invalid credentials" reached the web app as `[object Object]`
 * and rendered as the generic "Something went wrong".
 */
function normalizeMessage(raw: unknown, status: number): string | string[] {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'message' in raw) {
    const inner = (raw as { message: unknown }).message;
    if (typeof inner === 'string') return inner;
    if (Array.isArray(inner)) return inner.map(String);
  }
  return status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : 'Request failed';
}

// Centralized error handling: consistent API error shape, never leaks
// internal error details/stack traces to clients.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? normalizeMessage(exception.getResponse(), status)
      : 'Internal server error';

    if (!isHttpException) {
      this.logger.error(exception);
      if (process.env.SENTRY_DSN) Sentry.captureException(exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
