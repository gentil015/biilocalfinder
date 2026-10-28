import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';
import { RegisterDto, REGISTERABLE_ROLES } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { passwordResetCodeEmail } from './auth-email-templates';
import { EMAIL_SENDER, EmailSender } from '../notifications/channels/email-sender';

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
const REFRESH_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_EXPIRES_MS =
  Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? 10) * 60 * 1000;

// Returned verbatim whether or not the address belongs to an account — see
// requestPasswordReset for why that uniformity is the whole point.
const RESET_REQUEST_RESPONSE = {
  success: true,
  message: 'If that email exists, a reset code has been sent.',
};

// Floor on how long the request endpoint takes, so "account exists" (a DB
// write plus an SMTP round trip) isn't distinguishable from "account doesn't
// exist" (one indexed read) purely by response time.
const RESET_REQUEST_MIN_MS = 300;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    @Inject(EMAIL_SENDER) private emailSender: EmailSender,
  ) {}

  async register(dto: RegisterDto) {
    // Defense in depth: never rely on DTO validation alone for something
    // this sensitive. Even if a future change loosens the DTO, self-
    // registration as ADMIN (or anything outside the two public roles)
    // stays impossible here.
    if (!REGISTERABLE_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role for self-registration');
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // A PROVIDER signup now needs a Workspace (owner identity) as well as
    // the Provider profile row, since Provider.workspaceId is a required
    // 1:1 link (see docs/WORKSPACES.md) — done as one transaction so a
    // signup either produces a complete, usable workspace or nothing at
    // all, never a Provider stuck with no workspace.
    let user;
    try {
      user = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.user.create({
          data: {
            email: dto.email,
            phone: dto.phone,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: dto.role,
            ...(dto.role === 'CLIENT' ? { clientProfile: { create: {} } } : {}),
          },
        });

        // An invitation may have been sent before this person had an
        // account. Surface it as a pending membership immediately; the
        // token in the email is still what activates access.
        const pendingInvites = await tx.workspaceInvitation.findMany({
          where: {
            email: created.email.toLowerCase(),
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { workspaceId: true, role: true },
        });
        for (const invite of pendingInvites) {
          const existingMembership = await tx.workspaceMembership.findUnique({
            where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: created.id } },
          });
          if (!existingMembership) {
            await tx.workspaceMembership.create({
              data: {
                workspaceId: invite.workspaceId,
                userId: created.id,
                role: invite.role,
                status: 'INVITED',
                invitedEmail: created.email.toLowerCase(),
                invitedAt: new Date(),
              },
            });
          }
        }

        if (dto.role === 'PROVIDER') {
          const businessName = `${dto.firstName} ${dto.lastName}`;
          const workspace = await tx.workspace.create({
            data: {
              name: businessName,
              slug: await this.uniqueWorkspaceSlug(tx, businessName),
              type: 'INDIVIDUAL',
              ownerId: created.id,
            },
          });
          await tx.provider.create({
            data: { userId: created.id, workspaceId: workspace.id, businessName },
          });
          await tx.workspaceMembership.create({
            data: { workspaceId: workspace.id, userId: created.id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
          });
        }

        return created;
      });
    } catch (err) {
      // The duplicate pre-check above is a read, so it cannot see a
      // registration racing it. The unique indexes decide instead, and
      // without this the loser got a raw 500 instead of the 409 it means.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email or phone already registered');
      }
      throw err;
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  // Mirrors the slug de-duplication in
  // prisma/manual-sql/008_workspaces.sql's backfill — kept in sync so a
  // brand-new signup and a pre-existing-provider backfill produce slugs
  // the same way.
  private async uniqueWorkspaceSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
    const base = slugify(name) || 'workspace';
    let candidate = base;
    let suffix = 1;
    while (await tx.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revokedAt: null },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    // Rotation: revoke the used token, issue a brand new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: payload.sub } });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(userId: string, refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // Password reset: issues a single-use, short-lived, randomly generated
  // token and emails it a link. Two properties matter more than anything
  // else here:
  //
  //  1. No account enumeration. An unknown address and a known one produce
  //     the same body, the same status, and (see RESET_REQUEST_MIN_MS)
  //     roughly the same duration. A caller must not be able to turn this
  //     endpoint into "does this person have an account here".
  //  2. Only a hash of the token is stored, matching RefreshToken and
  //     ContactVerificationCode. Read access to the database must not be
  //     enough to reset anyone's password.
  async requestPasswordReset(email: string) {
    const startedAt = Date.now();
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, firstName: true },
      });

      if (user) {
        // Retire outstanding tokens before issuing a new one: only the most
        // recently requested link can ever work, so an older email that
        // leaked can't be used after a legitimate re-request.
        await this.prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        await this.prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: this.hashResetCode(code),
            expiresAt: new Date(Date.now() + PASSWORD_RESET_EXPIRES_MS),
          },
        });

        try {
          await this.emailSender.send(passwordResetCodeEmail(user.email, user.firstName, code));
        } catch (err) {
          // Swallowed on purpose. Letting the SMTP failure become a 503 would
          // hand back an oracle: real accounts would fail while unknown
          // addresses still returned 200. Better to tell the user the same
          // thing either way and shout about it here.
          this.logger.error(`Password reset email failed for ${user.id}: ${(err as Error).message}`);
        }
      }

      return RESET_REQUEST_RESPONSE;
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < RESET_REQUEST_MIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, RESET_REQUEST_MIN_MS - elapsed));
      }
    }
  }

  // Consumes the token and rotates the password. Throws a single generic
  // BadRequest for "unknown / already used / expired" so a caller can't
  // probe which tokens exist.
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashResetCode(token.trim());
    const stored = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true },
    });
    if (!stored) {
      throw new BadRequestException('This reset code is invalid or has expired.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // One transaction: the new password, the spent token, and the session
    // wipe either all land or none do. Revoking refresh tokens matters —
    // without it, a thief who logged in before the reset keeps a working
    // refresh token and can mint access tokens indefinitely.
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { success: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const accessToken = this.jwt.sign(
      { sub: userId, email, role },
      { secret: process.env.JWT_SECRET, expiresIn: ACCESS_EXPIRES_IN },
    );
    const refreshToken = this.jwt.sign(
      { sub: userId },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: REFRESH_EXPIRES_IN },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  // Refresh tokens are never stored in plaintext.
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Reset codes are only six digits, so a plain SHA-256 digest of the whole
  // space is trivially reversible from a database dump. A keyed HMAC keeps
  // the column useless without the server-side secret, which lives outside
  // the database (same reasoning as password hashing).
  private hashResetCode(code: string): string {
    const secret =
      process.env.PASSWORD_RESET_PEPPER ?? process.env.JWT_SECRET ?? 'insecure-reset-pepper';
    return crypto.createHmac('sha256', secret).update(code).digest('hex');
  }
}
