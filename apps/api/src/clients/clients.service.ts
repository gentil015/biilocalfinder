import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClientProfileDto } from './dto/update-client-profile.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, email: true, phone: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
    if (!profile) throw new NotFoundException('Client profile not found');
    return profile;
  }

  async updateMyProfile(userId: string, dto: UpdateClientProfileDto) {
    await this.getMyProfile(userId);

    await this.prisma.$transaction([
      this.prisma.clientProfile.update({ where: { userId }, data: { bio: dto.bio } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatarUrl: dto.avatarUrl,
        },
      }),
    ]);

    // Re-read rather than returning the bare update result: the caller needs
    // the joined user (firstName/lastName/avatarUrl) to refresh the session
    // copy without a second round-trip.
    return this.getMyProfile(userId);
  }
}
