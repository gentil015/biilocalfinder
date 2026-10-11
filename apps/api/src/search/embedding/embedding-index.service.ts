import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
  MAX_EMBEDDING_TEXT_LENGTH,
} from './embedding-provider.interface';

export const EMBEDDING_QUEUE = 'embedding-index';

interface OfferingForEmbedding {
  id: string;
  title: string | null;
  description: string | null;
  service: { name: string; description: string | null; category: { name: string } };
}

// Turns an offering's text into a pgvector `vector` literal and stores it
// on the row — the ONLY writer of service_offerings.embedding. Called
// (fire-and-forget, via the BullMQ queue) whenever an offering is created
// or its title/description changes; see EmbeddingIndexProcessor and
// ServiceOfferingsService. Also exposes reindexAll() for the standalone
// backfill script (scripts/backfill-embeddings.ts).
@Injectable()
export class EmbeddingIndexService {
  private readonly logger = new Logger(EmbeddingIndexService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private embeddingProvider: EmbeddingProvider,
    @InjectQueue(EMBEDDING_QUEUE) private queue: Queue<{ offeringId: string }>,
  ) {}

  // The one method offering-write call sites use (ServiceOfferingsService,
  // spec pattern: "prefer recording/triggering side effects from existing
  // application actions"). Never throws — enqueue failure should never
  // block creating/updating an offering; worst case an offering just isn't
  // semantically searchable until the next reindexAll backfill.
  async enqueueReindex(offeringId: string): Promise<void> {
    try {
      await this.queue.add('reindex-offering', { offeringId }, { removeOnComplete: true, removeOnFail: 50 });
    } catch (err) {
      this.logger.warn(`Failed to enqueue embedding reindex for offering ${offeringId}: ${(err as Error).message}`);
    }
  }

  // Same free-text surface the keyword search already covers (spec:
  // "wedding photographer" should find a provider offering "Wedding
  // Photography" via its service/category, not just its business name) —
  // deliberately excludes provider.businessName, since a business's brand
  // name rarely helps describe *what job it solves*, which is the whole
  // point of semantic recall here.
  buildEmbeddingText(offering: OfferingForEmbedding): string {
    const parts = [
      offering.service.category.name,
      offering.service.name,
      offering.service.description,
      offering.title,
      offering.description,
    ].filter((p): p is string => !!p && p.trim().length > 0);
    return parts.join('. ').slice(0, MAX_EMBEDDING_TEXT_LENGTH);
  }

  // Never throws — a failed/unavailable embed should never break the
  // offering write path that triggered it (same contract as
  // InteractionService.record). Silently no-ops when the provider returns
  // null (no key configured and the mock had nothing to hash, or the
  // vendor call failed).
  async reindexOffering(offeringId: string): Promise<void> {
    try {
      const offering = await this.prisma.serviceOffering.findUnique({
        where: { id: offeringId },
        select: {
          id: true,
          title: true,
          description: true,
          isActive: true,
          service: { select: { name: true, description: true, category: { select: { name: true } } } },
        },
      });
      if (!offering || !offering.isActive) return;

      const text = this.buildEmbeddingText(offering);
      const vector = await this.embeddingProvider.embed(text);
      if (!vector) return;

      await this.writeEmbedding(offering.id, vector);
    } catch (err) {
      this.logger.warn(`Failed to index embedding for offering ${offeringId}: ${(err as Error).message}`);
    }
  }

  // Backfill for offerings created before this feature shipped, or after
  // switching embedding providers/models. Processed in small batches so it
  // never holds a huge result set in memory or opens one giant transaction.
  async reindexAll(batchSize = 100): Promise<{ processed: number; skipped: number }> {
    let processed = 0;
    let skipped = 0;
    let cursor: string | undefined;

    for (;;) {
      const offerings = await this.prisma.serviceOffering.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          description: true,
          service: { select: { name: true, description: true, category: { select: { name: true } } } },
        },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });
      if (offerings.length === 0) break;

      for (const offering of offerings) {
        const text = this.buildEmbeddingText(offering);
        const vector = await this.embeddingProvider.embed(text);
        if (vector) {
          await this.writeEmbedding(offering.id, vector);
          processed++;
        } else {
          skipped++;
        }
      }

      cursor = offerings[offerings.length - 1].id;
      if (offerings.length < batchSize) break;
    }

    return { processed, skipped };
  }

  private async writeEmbedding(offeringId: string, vector: number[]): Promise<void> {
    const literal = toVectorLiteral(vector);
    await this.prisma.$executeRaw`
      UPDATE "service_offerings"
      SET embedding = ${literal}::vector,
          "embeddingModel" = ${this.embeddingProvider.modelName},
          "embeddingUpdatedAt" = now()
      WHERE id = ${offeringId}
    `;
  }
}

// pgvector accepts its input type as text in `[0.1,0.2,...]` form. Values
// come only from an EmbeddingProvider's own numeric output (never from
// unsanitized user text), but they're still bound as a single string
// parameter and cast with `::vector` in SQL rather than interpolated
// as raw SQL, exactly like every other dynamic value in this file uses
// Prisma.sql tagged templates elsewhere in the search module.
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => (Number.isFinite(v) ? v : 0)).join(',')}]`;
}
