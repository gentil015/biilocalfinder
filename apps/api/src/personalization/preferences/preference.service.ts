import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';

const DEFAULTS = {
  personalizationEnabled: true,
  locationBasedEnabled: true,
  recentlyViewedEnabled: true,
};

@Injectable()
export class PreferenceService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const existing = await this.prisma.userPreference.findUnique({ where: { userId } });
    return existing ?? { userId, ...DEFAULTS, preferredCategories: [], preferredServices: [] };
  }

  async update(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...DEFAULTS, ...dto },
      update: dto,
    });
  }

  // Cheap helper other services call to check the master toggle before
  // doing any personalization work at all (spec §25: "If personalization
  // is disabled: use generic recommendations... Do not disable core
  // search functionality").
  async isPersonalizationEnabled(userId: string): Promise<boolean> {
    const pref = await this.prisma.userPreference.findUnique({ where: { userId } });
    return pref?.personalizationEnabled ?? true;
  }
}
