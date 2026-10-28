import { randomBytes, timingSafeEqual } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

export const ACCESS_COOKIE = 'bii_access';
export const REFRESH_COOKIE = 'bii_refresh';
export const CSRF_COOKIE = 'bii_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const CSRF_MAX_AGE_MS = REFRESH_MAX_AGE_MS;

type SameSite = NonNullable<CookieOptions['sameSite']>;

function sameSite(): SameSite {
  const configured = (process.env.COOKIE_SAME_SITE ?? '').toLowerCase();
  if (configured === 'strict' || configured === 'lax' || configured === 'none') {
    return configured;
  }
  // Lax works for same-site deployments and still protects most cross-site
  // POSTs. A truly cross-site web/API split needs COOKIE_SAME_SITE=none.
  return 'lax';
}

function secureCookies(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.COOKIE_SECURE === 'true' ||
    sameSite() === 'none'
  );
}

function baseOptions(maxAge: number): CookieOptions {
  return {
    secure: secureCookies(),
    sameSite: sameSite(),
    maxAge,
  };
}

export function parseCookies(header?: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}

export function getCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name];
}

export function hasBearerToken(req: Request): boolean {
  return /^Bearer\s+\S+/i.test(req.headers.authorization ?? '');
}

export function newCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE, token, {
    ...baseOptions(CSRF_MAX_AGE_MS),
    httpOnly: false,
    path: '/',
  });
}

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  csrfToken: string = newCsrfToken(),
): string {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(ACCESS_MAX_AGE_MS),
    httpOnly: true,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(REFRESH_MAX_AGE_MS),
    httpOnly: true,
    path: '/api/auth',
  });
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

export function clearSessionCookies(res: Response): void {
  const expired: CookieOptions = { expires: new Date(0), secure: secureCookies(), sameSite: sameSite() };
  res.clearCookie(ACCESS_COOKIE, { ...expired, httpOnly: true, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...expired, httpOnly: true, path: '/api/auth' });
  res.clearCookie(CSRF_COOKIE, { ...expired, httpOnly: false, path: '/' });
}

export function csrfTokensMatch(cookieValue?: string, headerValue?: string | string[]): boolean {
  if (!cookieValue || typeof headerValue !== 'string') return false;
  const expected = Buffer.from(cookieValue);
  const received = Buffer.from(headerValue);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
