import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SetWeeklyScheduleDto } from './dto/set-weekly-schedule.dto';
import { SetAvailabilityExceptionDto } from './dto/set-exception.dto';
import { SetAvailabilityStatusDto } from './dto/set-availability-status.dto';
import { ProviderContextService } from '../providers/provider-context.service';
import {
  AVAILABILITY_SEARCH_HORIZON_DAYS,
  computeAvailabilitySummary,
  toWeeklyDisplay,
} from './availability-summary';

const MAX_FUTURE_EXCEPTION_DAYS = 365;

@Injectable()
export class AvailabilityService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private providerContext: ProviderContextService,
  ) {}

  private async providerFor(userId: string) {
    return this.providerContext.resolveForUser(userId);
  }

  // ---------------------------------------------------------------------
  // Provider-owned: edit the weekly pattern and date exceptions
  // ---------------------------------------------------------------------

  async getMine(userId: string) {
    const provider = await this.providerFor(userId);
    const [weekly, exceptions] = await Promise.all([
      this.prisma.availability.findMany({ where: { providerId: provider.id }, orderBy: { dayOfWeek: 'asc' } }),
      this.prisma.availabilityException.findMany({
        where: { providerId: provider.id, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        orderBy: { date: 'asc' },
      }),
    ]);
    return {
      status: provider.availabilityStatus,
      weekly: toWeeklyDisplay(weekly),
      raw: weekly,
      exceptions,
    };
  }

  // Replaces the whole week atomically — a day simply absent from `days`
  // becomes unavailable, matching how the schedule editor UI works (a
  // 7-row table, toggle days off rather than deleting rows).
  async setWeeklySchedule(userId: string, dto: SetWeeklyScheduleDto) {
    const provider = await this.providerFor(userId);
    const seen = new Set<number>();
    for (const d of dto.days) {
      if (seen.has(d.dayOfWeek)) throw new BadRequestException(`Day ${d.dayOfWeek} was submitted more than once`);
      seen.add(d.dayOfWeek);
      if (d.startTime >= d.endTime) throw new BadRequestException('startTime must be before endTime');
    }

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.availability.deleteMany({ where: { providerId: provider.id } });
      if (dto.days.length > 0) {
        await tx.availability.createMany({
          data: dto.days.map((d) => ({
            providerId: provider.id,
            dayOfWeek: d.dayOfWeek,
            startTime: d.startTime,
            endTime: d.endTime,
            isActive: d.isActive ?? true,
          })),
        });
      }
    });

    return this.getMine(userId);
  }

  async setStatus(userId: string, dto: SetAvailabilityStatusDto) {
    const provider = await this.providerFor(userId);
    const wasAvailable = provider.availabilityStatus === 'AVAILABLE';
    await this.prisma.provider.update({ where: { id: provider.id }, data: { availabilityStatus: dto.status } });

    // "Favorite provider available" (spec §10) — the moment-based signal we
    // can fire reliably: a provider explicitly flipping to open for work.
    // A daily sweep for "today's weekly slot just started" would fire for
    // every provider every morning regardless of whether anything actually
    // changed, which is closer to spam than a useful nudge — so this stays
    // scoped to the real status transition.
    if (!wasAvailable && dto.status === 'AVAILABLE') {
      const favorites = await this.prisma.favorite.findMany({ where: { providerId: provider.id }, select: { userId: true } });
      await Promise.all(
        favorites.map((f) =>
          this.notifications.notify({
            userId: f.userId,
            type: 'FAVORITE_PROVIDER_AVAILABLE',
            title: `${provider.businessName} is now available`,
            body: 'A provider you favorited just opened up for work.',
            data: { providerId: provider.id },
          }),
        ),
      );
    }

    return this.getMine(userId);
  }

  async setException(userId: string, dto: SetAvailabilityExceptionDto) {
    const provider = await this.providerFor(userId);
    const date = new Date(`${dto.date}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');
    const maxDate = new Date(Date.now() + MAX_FUTURE_EXCEPTION_DAYS * 86400000);
    if (date.getTime() > maxDate.getTime()) {
      throw new BadRequestException(`Date must be within ${MAX_FUTURE_EXCEPTION_DAYS} days`);
    }

    return this.prisma.availabilityException.upsert({
      where: { providerId_date: { providerId: provider.id, date } },
      create: { providerId: provider.id, date, isAvailable: dto.isAvailable, note: dto.note },
      update: { isAvailable: dto.isAvailable, note: dto.note },
    });
  }

  async removeException(userId: string, id: string) {
    const provider = await this.providerFor(userId);
    const exception = await this.prisma.availabilityException.findUnique({ where: { id } });
    if (!exception || exception.providerId !== provider.id) throw new NotFoundException('Exception not found');
    await this.prisma.availabilityException.delete({ where: { id } });
    return { deleted: true };
  }

  // ---------------------------------------------------------------------
  // Public: what search/profile pages show
  // ---------------------------------------------------------------------

  async summaryForProvider(providerId: string, now = new Date()) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException('Provider not found');

    const [weekly, exceptions] = await Promise.all([
      this.prisma.availability.findMany({ where: { providerId } }),
      this.prisma.availabilityException.findMany({
        where: {
          providerId,
          date: { gte: new Date(now.getTime() - 86400000), lte: new Date(now.getTime() + AVAILABILITY_SEARCH_HORIZON_DAYS * 86400000) },
        },
      }),
    ]);

    const summary = computeAvailabilitySummary(weekly, exceptions, {
      paused: provider.availabilityStatus === 'UNAVAILABLE',
      now,
    });
    return { ...summary, weekly: toWeeklyDisplay(weekly), manualStatus: provider.availabilityStatus };
  }

  // Batched version for search result lists — one query per table instead
  // of N, since the search page can show 20+ providers at once.
  async summariesForProviders(providerIds: string[], now = new Date()) {
    if (providerIds.length === 0) return new Map<string, ReturnType<typeof computeAvailabilitySummary>>();
    const [providers, weeklyRows, exceptionRows] = await Promise.all([
      this.prisma.provider.findMany({ where: { id: { in: providerIds } }, select: { id: true, availabilityStatus: true } }),
      this.prisma.availability.findMany({ where: { providerId: { in: providerIds } } }),
      this.prisma.availabilityException.findMany({
        where: {
          providerId: { in: providerIds },
          date: { gte: new Date(now.getTime() - 86400000), lte: new Date(now.getTime() + AVAILABILITY_SEARCH_HORIZON_DAYS * 86400000) },
        },
      }),
    ]);

    const map = new Map<string, ReturnType<typeof computeAvailabilitySummary>>();
    for (const p of providers) {
      const weekly = weeklyRows.filter((w) => w.providerId === p.id);
      const exceptions = exceptionRows.filter((e) => e.providerId === p.id);
      map.set(p.id, computeAvailabilitySummary(weekly, exceptions, { paused: p.availabilityStatus === 'UNAVAILABLE', now }));
    }
    return map;
  }
}
