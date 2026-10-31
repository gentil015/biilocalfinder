import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { CreateProviderExperienceDto } from './dto/create-provider-experience.dto';
import { UpdateProviderExperienceDto } from './dto/update-provider-experience.dto';
import { CreateProviderEducationDto } from './dto/create-provider-education.dto';
import { UpdateProviderEducationDto } from './dto/update-provider-education.dto';

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  return new Date(value);
}

function assertDateOrder(start?: Date | null, end?: Date | null) {
  if (start && end && end < start) {
    throw new BadRequestException('The end date cannot be before the start date');
  }
}

// Deduplicate by case-insensitive label and drop blanks, so re-saving an
// edited form never stores the same skill twice.
function normalizeSkills(skills?: string[] | null): string[] | undefined {
  if (skills == null) return undefined;
  const seen = new Set<string>();
  return skills
    .map((skill) => skill.trim())
    .filter((skill) => {
      if (!skill) return false;
      const key = skill.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
}

@Injectable()
export class ProfessionalProfileService {
  constructor(
    private prisma: PrismaService,
    private providerContext: ProviderContextService,
  ) {}

  private getProvider(userId: string) {
    return this.providerContext.resolveForUser(userId);
  }

  // ---------- Experience ----------

  async listExperience(userId: string) {
    const provider = await this.getProvider(userId);
    return this.prisma.providerExperience.findMany({
      where: { providerId: provider.id },
      orderBy: [{ position: 'asc' }, { startDate: 'desc' }],
    });
  }

  async createExperience(userId: string, dto: CreateProviderExperienceDto) {
    const provider = await this.getProvider(userId);
    const startDate = toDate(dto.startDate);
    const isCurrent = dto.isCurrent ?? false;
    const endDate = isCurrent ? null : toDate(dto.endDate);
    assertDateOrder(startDate, endDate);

    const position =
      dto.position ?? (await this.prisma.providerExperience.count({ where: { providerId: provider.id } }));

    return this.prisma.providerExperience.create({
      data: {
        providerId: provider.id,
        title: dto.title.trim(),
        organization: dto.organization.trim(),
        location: dto.location?.trim() || null,
        startDate: startDate!,
        endDate,
        isCurrent,
        description: dto.description?.trim() || null,
        position,
      },
    });
  }

  async updateExperience(userId: string, id: string, dto: UpdateProviderExperienceDto) {
    const provider = await this.getProvider(userId);
    const existing = await this.prisma.providerExperience.findUnique({ where: { id } });
    if (!existing || existing.providerId !== provider.id) {
      throw new NotFoundException('Experience entry not found');
    }

    const startDate = dto.startDate !== undefined ? toDate(dto.startDate) : existing.startDate;
    const isCurrent = dto.isCurrent ?? existing.isCurrent;
    let endDate = dto.endDate !== undefined ? toDate(dto.endDate) : existing.endDate;
    if (isCurrent) endDate = null;
    assertDateOrder(startDate, endDate);

    return this.prisma.providerExperience.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        organization: dto.organization?.trim(),
        location: dto.location !== undefined ? dto.location?.trim() || null : undefined,
        startDate: startDate ?? undefined,
        endDate,
        isCurrent,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        position: dto.position,
      } satisfies Prisma.ProviderExperienceUpdateInput,
    });
  }

  async removeExperience(userId: string, id: string) {
    const provider = await this.getProvider(userId);
    const existing = await this.prisma.providerExperience.findUnique({ where: { id } });
    if (!existing || existing.providerId !== provider.id) {
      throw new NotFoundException('Experience entry not found');
    }
    await this.prisma.providerExperience.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Education ----------

  async listEducation(userId: string) {
    const provider = await this.getProvider(userId);
    return this.prisma.providerEducation.findMany({
      where: { providerId: provider.id },
      orderBy: [{ position: 'asc' }, { startDate: 'desc' }],
    });
  }

  async createEducation(userId: string, dto: CreateProviderEducationDto) {
    const provider = await this.getProvider(userId);
    const startDate = toDate(dto.startDate);
    const endDate = toDate(dto.endDate);
    assertDateOrder(startDate, endDate);

    const position =
      dto.position ?? (await this.prisma.providerEducation.count({ where: { providerId: provider.id } }));

    return this.prisma.providerEducation.create({
      data: {
        providerId: provider.id,
        school: dto.school.trim(),
        degree: dto.degree?.trim() || null,
        fieldOfStudy: dto.fieldOfStudy?.trim() || null,
        skills: normalizeSkills(dto.skills) ?? [],
        startDate,
        endDate,
        description: dto.description?.trim() || null,
        position,
      },
    });
  }

  async updateEducation(userId: string, id: string, dto: UpdateProviderEducationDto) {
    const provider = await this.getProvider(userId);
    const existing = await this.prisma.providerEducation.findUnique({ where: { id } });
    if (!existing || existing.providerId !== provider.id) {
      throw new NotFoundException('Education entry not found');
    }

    const startDate = dto.startDate !== undefined ? toDate(dto.startDate) : existing.startDate;
    const endDate = dto.endDate !== undefined ? toDate(dto.endDate) : existing.endDate;
    assertDateOrder(startDate, endDate);

    return this.prisma.providerEducation.update({
      where: { id },
      data: {
        school: dto.school?.trim(),
        degree: dto.degree !== undefined ? dto.degree?.trim() || null : undefined,
        fieldOfStudy: dto.fieldOfStudy !== undefined ? dto.fieldOfStudy?.trim() || null : undefined,
        skills: normalizeSkills(dto.skills),
        startDate,
        endDate,
        description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
        position: dto.position,
      } satisfies Prisma.ProviderEducationUpdateInput,
    });
  }

  async removeEducation(userId: string, id: string) {
    const provider = await this.getProvider(userId);
    const existing = await this.prisma.providerEducation.findUnique({ where: { id } });
    if (!existing || existing.providerId !== provider.id) {
      throw new NotFoundException('Education entry not found');
    }
    await this.prisma.providerEducation.delete({ where: { id } });
    return { success: true };
  }
}
