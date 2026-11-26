import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  private getAudiences(): string[] {
    const raw = [
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ALLOWED_AUDIENCES,
    ]
      .filter(Boolean)
      .join(',');
    const audiences = raw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (audiences.length === 0) {
      throw new BadRequestException('Google authentication is not configured');
    }
    return Array.from(new Set(audiences));
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const audiences = this.getAudiences();
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const allowedIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);
    if (!payload.iss || !allowedIssuers.has(payload.iss)) {
      throw new UnauthorizedException('Invalid Google token issuer');
    }

    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email address is not verified');
    }

    const email = payload.email.trim().toLowerCase();
    const firstName = (payload.given_name ?? '').trim();
    const lastName = (payload.family_name ?? '').trim();
    const fallbackName = (payload.name ?? '').trim();
    const [fallbackFirst, ...fallbackRest] = fallbackName.split(/\s+/).filter(Boolean);

    return {
      sub: payload.sub,
      email,
      emailVerified: true,
      firstName: firstName || fallbackFirst || email.split('@')[0] || 'Google',
      lastName: lastName || fallbackRest.join(' ') || 'User',
      avatarUrl: payload.picture?.trim() || undefined,
    };
  }
}
