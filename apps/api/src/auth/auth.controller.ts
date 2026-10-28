import { Body, Controller, Get, Post, UseGuards, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  getCookie,
  newCsrfToken,
  setCsrfCookie,
  setSessionCookies,
} from './session-cookies';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Brute-force / credential-stuffing / signup-spam protection: these three
  // endpoints get a much tighter limit than the global 100/min default.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.register(dto);
    return this.sendSession(req, res, session);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto);
    return this.sendSession(req, res, session);
  }

  // The CSRF cookie is deliberately readable by the web app (double-submit
  // pattern). Cross-origin deployments cannot read the API's cookie for the
  // web origin, so this endpoint returns the same value in the body too.
  @Get('csrf')
  csrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existing = getCookie(req, CSRF_COOKIE);
    const token = existing ?? newCsrfToken();
    if (!existing) setCsrfCookie(res, token);
    res.setHeader('Cache-Control', 'no-store');
    return { csrfToken: token };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto?.refreshToken ?? getCookie(req, REFRESH_COOKIE);
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');
    const session = await this.authService.refresh(refreshToken);
    return this.sendSession(req, res, session);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: { id: string },
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto?.refreshToken ?? getCookie(req, REFRESH_COOKIE);
    try {
      if (refreshToken) await this.authService.logout(user.id, refreshToken);
    } finally {
      clearSessionCookies(res);
    }
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  // Throttled too: the token is 256 bits of entropy so guessing it is not the
  // risk, but this is the endpoint that *spends* one and should not be
  // brute-forceable against a short/custom token from an older deployment.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('password-reset/confirm')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  private sendSession(
    req: Request,
    res: Response,
    session: { accessToken: string; refreshToken: string },
  ) {
    const csrfToken = getCookie(req, CSRF_COOKIE) ?? newCsrfToken();
    setSessionCookies(res, session, csrfToken);
    res.setHeader('Cache-Control', 'no-store');
    // Tokens remain in the body for native/legacy clients. The web app
    // ignores them and relies on the HttpOnly cookies above.
    return { ...session, csrfToken };
  }
}
