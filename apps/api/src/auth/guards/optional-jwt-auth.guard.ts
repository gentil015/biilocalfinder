import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Overridden so a missing/invalid token doesn't throw — it just means
  // req.user stays null, and the endpoint falls back to its
  // non-personalized behavior. canActivate's default implementation
  // always returns true once handleRequest stops throwing.
  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
