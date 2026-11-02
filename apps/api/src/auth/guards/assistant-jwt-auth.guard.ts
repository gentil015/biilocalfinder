import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Optional authentication for endpoints that serve both guests and
// signed-in users. A missing token is fine (the request stays public), but
// an expired or malformed token is surfaced as a 401 so the web client can
// refresh and retry — otherwise a stale cookie would silently downgrade a
// signed-in user to the guest experience.
@Injectable()
export class AssistantJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown): TUser {
    if (err) throw err;
    const reason = (info as { name?: string } | undefined)?.name;
    if (reason === 'TokenExpiredError' || reason === 'JsonWebTokenError') {
      throw new UnauthorizedException('Session expired');
    }
    return (user || null) as TUser;
  }
}
