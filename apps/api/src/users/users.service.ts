import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        locale: true,
        createdAt: true,
        // passwordHash intentionally excluded — never returned to clients
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Persists the display language. Validation of the tag itself is the DTO's
   * job (UpdateLocaleDto whitelists SUPPORTED_LOCALES), so this trusts the
   * input rather than re-checking it — the global ValidationPipe runs with
   * forbidNonWhitelisted, so an unknown tag is a 400 before it gets here.
   *
   * Returns the same shape as findById so the client can swap its session
   * copy without a second round trip.
   */
  async updateLocale(id: string, locale: string) {
    await this.prisma.user.update({ where: { id }, data: { locale } });
    return this.findById(id);
  }
}
