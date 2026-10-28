import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfTokensMatch,
  getCookie,
  hasBearerToken,
} from '../session-cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Login/register/reset either establish a session or are intentionally
// usable without one. Protecting them would block a browser that still has
// a stale session cookie from signing in as a different user.
const EXEMPT_PATHS = [
  /\/auth\/login$/,
  /\/auth\/register$/,
  /\/auth\/password-reset\/request$/,
  /\/auth\/password-reset\/confirm$/,
];

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = req.method.toUpperCase();
    if (SAFE_METHODS.has(method)) return true;

    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    if (EXEMPT_PATHS.some((pattern) => pattern.test(path))) return true;

    // Bearer-token clients (mobile/native, legacy API consumers) are not
    // vulnerable to browser CSRF and do not need a CSRF cookie.
    if (hasBearerToken(req)) return true;

    // No cookie session, no CSRF requirement. Public writes still get the
    // global throttler and their own validation.
    if (!getCookie(req, ACCESS_COOKIE)) return true;

    const cookieToken = getCookie(req, CSRF_COOKIE);
    const headerToken = req.headers[CSRF_HEADER];
    if (!csrfTokensMatch(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }
    return true;
  }
}
