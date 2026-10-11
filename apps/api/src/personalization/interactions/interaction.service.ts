import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InteractionEntityType, InteractionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CACHE_INVALIDATING_INTERACTIONS,
  INTERACTION_WEIGHTS,
} from '../recommendation/recommendation.constants';

export const PERSONALIZATION_QUEUE = 'personalization';

interface CategoryServiceRef {
  categoryId?: string;
  serviceId?: string;
}

@Injectable()
export class InteractionService {
  private readonly logger = new Logger('InteractionService');

  constructor(
    private prisma: PrismaService,
    @InjectQueue(PERSONALIZATION_QUEUE) private queue: Queue,
  ) {}

  // The one method the rest of the app calls (spec §19: "prefer recording
  // interactions automatically from existing application actions"). Never
  // throws — a personalization hiccup should never break the calling
  // business action (a booking still gets created even if this fails).
  async record(
    userId: string,
    type: InteractionType,
    entityType?: InteractionEntityType,
    entityId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.userInteraction.create({
        data: { userId, type, entityType, entityId, metadata: metadata as Prisma.InputJsonValue },
      });

      const weight = INTERACTION_WEIGHTS[type] ?? 0;
      if (weight !== 0) {
        let refs: CategoryServiceRef[] = [];
        if (type === 'SEARCH' && typeof metadata?.query === 'string') {
          const ref = await this.detectCategoryAndService(metadata.query);
          if (ref.categoryId || ref.serviceId) refs = [ref];
        } else if (entityType && entityId) {
          refs = await this.resolveCategoryService(entityType, entityId);
        }
        // A provider interaction can touch several categories/services —
        // split the weight evenly rather than crediting each one in full.
        const splitWeight = refs.length > 0 ? weight / refs.length : 0;
        for (const ref of refs) {
          await this.upsertInterest(userId, ref, splitWeight);
        }
      }

      if (CACHE_INVALIDATING_INTERACTIONS.includes(type)) {
        await this.queue.add('invalidate-cache', { userId }, { removeOnComplete: true });
      }
    } catch (err) {
      // Personalization is a soft enhancement — log and move on.
      this.logger.warn(`Failed to record interaction (${type}): ${(err as Error).message}`);
    }
  }

  // Simple rule-based keyword matching (spec §4) — no NLP/LLM. Used for
  // SEARCH interactions so a free-text query still contributes to
  // category/service interest.
  async detectCategoryAndService(query: string): Promise<CategoryServiceRef> {
    const q = query.trim().toLowerCase();
    if (!q) return {};

    const service = await this.prisma.service.findFirst({
      where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, categoryId: true },
    });
    if (service) return { categoryId: service.categoryId, serviceId: service.id };

    const category = await this.prisma.serviceCategory.findFirst({
      where: { isActive: true, name: { contains: q, mode: 'insensitive' } },
      select: { id: true },
    });
    if (category) return { categoryId: category.id };

    return {};
  }

  private async resolveCategoryService(
    entityType: InteractionEntityType,
    entityId: string,
  ): Promise<CategoryServiceRef[]> {
    switch (entityType) {
      case 'SERVICE': {
        const service = await this.prisma.service.findUnique({ where: { id: entityId } });
        return service ? [{ categoryId: service.categoryId, serviceId: service.id }] : [];
      }
      case 'SERVICE_OFFERING': {
        const offering = await this.prisma.serviceOffering.findUnique({
          where: { id: entityId },
          include: { service: true },
        });
        return offering ? [{ categoryId: offering.service.categoryId, serviceId: offering.service.id }] : [];
      }
      case 'SERVICE_CATEGORY':
        return [{ categoryId: entityId }];
      case 'PROVIDER': {
        const services = await this.prisma.serviceOffering.findMany({
          where: { providerId: entityId },
          include: { service: true },
        });
        const seen = new Set<string>();
        const refs: CategoryServiceRef[] = [];
        for (const ps of services) {
          const key = `${ps.service.categoryId}:${ps.service.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          refs.push({ categoryId: ps.service.categoryId, serviceId: ps.service.id });
        }
        return refs;
      }
      case 'SERVICE_REQUEST': {
        const request = await this.prisma.serviceRequest.findUnique({ where: { id: entityId } });
        if (!request) return [];
        const service = await this.prisma.service.findUnique({ where: { id: request.serviceId } });
        return service ? [{ categoryId: service.categoryId, serviceId: service.id }] : [];
      }
      case 'BOOKING': {
        const booking = await this.prisma.booking.findUnique({
          where: { id: entityId },
          include: { serviceRequest: true },
        });
        if (!booking) return [];
        const service = await this.prisma.service.findUnique({
          where: { id: booking.serviceRequest.serviceId },
        });
        return service ? [{ categoryId: service.categoryId, serviceId: service.id }] : [];
      }
      case 'QUOTE': {
        const quote = await this.prisma.quote.findUnique({
          where: { id: entityId },
          include: { request: true },
        });
        if (!quote) return [];
        const service = await this.prisma.service.findUnique({ where: { id: quote.request.serviceId } });
        return service ? [{ categoryId: service.categoryId, serviceId: service.id }] : [];
      }
      default:
        return [];
    }
  }

  private async upsertInterest(userId: string, ref: CategoryServiceRef, weight: number) {
    if (!ref.categoryId && !ref.serviceId) return;

    const categoryId = ref.categoryId ?? null;
    const serviceId = ref.serviceId ?? null;

    // Not findUnique on the `userId_categoryId_serviceId` compound key:
    // Prisma types those members as non-nullable even though the columns are
    // `String?`, and the method explicitly allows one of them to be null.
    // findFirst matches on the same values and, unlike a unique lookup, is
    // honest about Postgres treating NULLs as distinct — the @@unique
    // constraint doesn't dedupe rows containing a NULL anyway, so an
    // upsert-style "update if seen" read is the correct behaviour here.
    const existing = await this.prisma.userInterest.findFirst({
      where: { userId, categoryId, serviceId },
    });

    if (existing) {
      await this.prisma.userInterest.update({
        where: { id: existing.id },
        data: {
          score: existing.score + weight,
          interactionCount: { increment: 1 },
          lastInteractionAt: new Date(),
        },
      });
    } else {
      await this.prisma.userInterest.create({
        data: { userId, categoryId, serviceId, score: weight, interactionCount: 1 },
      });
    }
  }
}
