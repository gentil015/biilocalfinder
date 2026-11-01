import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RestrictionType } from '@prisma/client';
import { ACCESS_COOKIE, getCookie } from '../session-cookies';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req: any) =>
        ExtractJwt.fromAuthHeaderAsBearerToken()(req) ?? getCookie(req, ACCESS_COOKIE),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        status: true,
        accountRestrictions: {
          where: {
            status: 'ACTIVE',
            restrictionType: {
              in: [RestrictionType.TEMPORARY_SUSPENSION, RestrictionType.PERMANENT_SUSPENSION],
            },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if (user.accountRestrictions.length > 0) {
      throw new UnauthorizedException('Account access is temporarily restricted');
    }
    // Attached to request.user — never includes passwordHash.
    return { id: user.id, email: user.email, role: user.role, firstName: user.firstName };
  }
}
