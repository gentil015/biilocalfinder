import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

type PrismaLikeError = { code?: string; message?: string };

function isPrismaError(exception: unknown): exception is PrismaLikeError {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) return true;
  if (exception instanceof Prisma.PrismaClientInitializationError) return true;
  if (exception instanceof Prisma.PrismaClientRustPanicError) return true;
  if (exception instanceof Prisma.PrismaClientUnknownRequestError) return true;
  if (exception instanceof Prisma.PrismaClientValidationError) return true;
  const name = (exception as { name?: string } | null)?.name ?? '';
  return name.startsWith('PrismaClient');
}

/**
 * `HttpException.getResponse()` is a string for `new HttpException('x', 400)`
 * but an object (`{ message, error, statusCode }`) for every built-in
 * exception — `UnauthorizedException`, `BadRequestException`, and so on.
 * Forwarding that object verbatim puts a nested object where clients expect
 * `message` to be a string (or an array of strings, for validation failures).
 */
function normalizeMessage(raw: unknown, status: number): string | string[] {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'message' in raw) {
    const inner = (raw as { message: unknown }).message;
    if (typeof inner === 'string') return inner;
    if (Array.isArray(inner)) return inner.map(String);
  }
  return status >= 500 ? 'Service temporarily unavailable. Please try again shortly.' : 'Request failed';
}

function classifyException(exception: unknown): { status: number; message: string | string[]; expose: boolean } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return {
      status,
      message: normalizeMessage(exception.getResponse(), status),
      expose: status < 500,
    };
  }

  if (isPrismaError(exception)) {
    const code = (exception as PrismaLikeError).code;
    if (code === 'P2002') {
      return { status: HttpStatus.CONFLICT, message: 'That conflicts with existing data.', expose: true };
    }
    if (code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, message: 'Requested resource was not found.', expose: true };
    }
    if (code === 'P1001' || code === 'P1002' || code === 'P1008' || code === 'P1017' || code === 'P2024' || code === 'P2034') {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporarily unavailable. Please try again shortly.',
        expose: true,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Service temporarily unavailable. Please try again shortly.',
      expose: false,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Service temporarily unavailable. Please try again shortly.',
    expose: false,
  };
}

// Centralized error handling: consistent API error shape, never leaks
// internal error details/stack traces to clients.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const { status, message, expose } = classifyException(exception);
    const requestId = request.requestId ?? response.getHeader(REQUEST_ID_HEADER)?.toString();

    const logPayload = {
      requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode: status,
      userId: (request as any).user?.id,
      ip: request.ip,
      errorName: (exception as { name?: string } | null)?.name,
      errorCode: (exception as { code?: string } | null)?.code,
    };

    if (status >= 500) {
      this.logger.error({ ...logPayload, stack: (exception as Error)?.stack }, 'Unhandled request error');
      if (process.env.SENTRY_DSN) Sentry.captureException(exception);
    } else if (!expose) {
      this.logger.warn(logPayload, 'Request rejected');
    } else {
      this.logger.warn(logPayload, 'Request failed');
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      requestId,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
