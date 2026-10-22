import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProviderContextService } from '../../providers/provider-context.service';

export interface ProviderAnalyticsSummary {
  periodLabel: string;
  profileViews: number;
  serviceViews: number;
  requests: number;
  quotesSent: number;
  bookings: number;
  conversionRate: number; // percentage: bookings / requests, 0 when there are no requests yet
  topSearchedService: { serviceId: string; serviceName: string; count: number } | null;
  mostViewedService: { serviceOfferingId: string; serviceName: string; count: number } | null;
}

// Provider analytics dashboard (spec §7) — "This month" only, aggregated
// from data the platform already records elsewhere (UserInteraction,
// ServiceRequest, Quote, Booking). No new tracking tables, no ML: every
// number here is a plain count or ratio over existing rows, same
// rule-based philosophy as the rest of personalization.
@Injectable()
export class ProviderAnalyticsService {
  constructor(private prisma: PrismaService, private providerContext: ProviderContextService) {}

  async getMonthlySummary(providerUserId: string): Promise<ProviderAnalyticsSummary> {
    // Was `prisma.provider.findUnique({ where: { userId } })` — invalid now
    // that Provider.userId isn't @unique (manual-sql/010), so it threw at
    // runtime and 500'd. Resolve via ProviderContextService, then re-fetch by
    // id to attach `services`, which the counts below read.
    const resolved = await this.providerContext.resolveForUser(providerUserId).catch(() => null);
    if (!resolved) throw new ForbiddenException('Provider profile not found');

    const provider = await this.prisma.provider.findUniqueOrThrow({
      where: { id: resolved.id },
      include: { services: { include: { service: true } } },
    });

    const start = startOfCurrentMonth();
    const offeringIds = provider.services.map((o: any) => o.id);
    const serviceById = new Map<string, { id: string; name: string }>(provider.services.map((o: any) => [o.id, o.service]));

    const [profileViews, serviceViewRows, requests, quotesSent, bookings, searchRows] = await Promise.all([
      this.prisma.userInteraction.count({
        where: { type: 'VIEW_PROVIDER', entityType: 'PROVIDER', entityId: provider.id, createdAt: { gte: start } },
      }),
      offeringIds.length
        ? this.prisma.userInteraction.findMany({
            where: {
              type: 'VIEW_SERVICE',
              entityType: 'SERVICE_OFFERING',
              entityId: { in: offeringIds },
              createdAt: { gte: start },
            },
            select: { entityId: true },
          })
        : Promise.resolve([] as { entityId: string | null }[]),
      // "Requests" (spec §7) — service requests addressed directly to this
      // provider this month.
      this.prisma.serviceRequest.count({ where: { providerId: provider.id, createdAt: { gte: start } } }),
      this.prisma.quote.count({ where: { providerId: provider.id, createdAt: { gte: start } } }),
      this.prisma.booking.count({ where: { providerId: provider.id, createdAt: { gte: start } } }),
      // Global SEARCH interactions this month, matched below against this
      // provider's own service names. Capped — a monthly dashboard stat
      // doesn't need every search ever made, and this keeps the query cheap.
      this.prisma.userInteraction.findMany({
        where: { type: 'SEARCH', createdAt: { gte: start } },
        select: { metadata: true },
        take: 5000,
      }),
    ]);

    const mostViewedService = this.getMostViewedService(
      serviceViewRows.map((r: any) => r.entityId).filter((id: any): id is string => !!id),
      serviceById as any,
    );

    const topSearchedService = this.getTopSearchedService(provider.services.map((o: any) => o.service), searchRows);

    return {
      periodLabel: 'This month',
      profileViews,
      serviceViews: serviceViewRows.length,
      requests,
      quotesSent,
      bookings,
      conversionRate: requests > 0 ? Math.round((bookings / requests) * 100) : 0,
      topSearchedService,
      mostViewedService,
    };
  }

  // Most-viewed of the provider's own service offerings this month, by raw
  // VIEW_SERVICE interaction count.
  private getMostViewedService(
    offeringIdsViewed: string[],
    serviceById: Map<string, { id: string; name: string }>,
  ): { serviceOfferingId: string; serviceName: string; count: number } | null {
    if (!offeringIdsViewed.length) return null;

    const counts = new Map<string, number>();
    for (const id of offeringIdsViewed) counts.set(id, (counts.get(id) ?? 0) + 1);

    let winnerId: string | null = null;
    let winnerCount = 0;
    for (const [id, count] of counts) {
      if (count > winnerCount) {
        winnerCount = count;
        winnerId = id;
      }
    }
    if (!winnerId) return null;
    const service = serviceById.get(winnerId);
    if (!service) return null; // offering's service was somehow removed — skip rather than show a blank name
    return { serviceOfferingId: winnerId, serviceName: service.name, count: winnerCount };
  }

  // Simple rule-based keyword matching (same approach as
  // InteractionService.detectCategoryAndService) — no NLP/LLM. A search
  // query counts toward a service if the query and the service name
  // contain one another, case-insensitively.
  private getTopSearchedService(
    services: { id: string; name: string }[],
    searchRows: { metadata: unknown }[],
  ): { serviceId: string; serviceName: string; count: number } | null {
    if (!services.length || !searchRows.length) return null;

    const counts = new Map<string, number>();
    for (const row of searchRows) {
      const query = (row.metadata as Record<string, unknown> | null)?.query;
      if (typeof query !== 'string' || !query.trim()) continue;
      const q = query.trim().toLowerCase();
      for (const service of services) {
        const name = service.name.toLowerCase();
        if (q.includes(name) || name.includes(q)) {
          counts.set(service.id, (counts.get(service.id) ?? 0) + 1);
        }
      }
    }

    let winnerId: string | null = null;
    let winnerCount = 0;
    for (const [id, count] of counts) {
      if (count > winnerCount) {
        winnerCount = count;
        winnerId = id;
      }
    }
    if (!winnerId) return null;
    const service = services.find((s) => s.id === winnerId)!;
    return { serviceId: winnerId, serviceName: service.name, count: winnerCount };
  }
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
