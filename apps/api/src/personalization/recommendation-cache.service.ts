import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { RECOMMENDATION_CACHE_PREFIX, RECOMMENDATION_CACHE_TTL_SECONDS } from './recommendation/recommendation.constants';

// Redis is the fast, live lookup on the hot path (spec §21, key format
// "recommendations:user:{userId}"); the RecommendationCache Prisma table
// (spec §23-24) is a lightweight, inspectable record of what was last
// generated and why, for debugging/admin visibility after a cache flush —
// it is written but never read on the hot path.
@Injectable()
export class RecommendationCacheService implements OnModuleDestroy {
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    // ioredis parses `rediss://` (TLS) and credentials from the URL itself,
    // so pass the string through rather than hand-rolling options.
    this.redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
  }

  async onModuleDestroy() {
    this.redis.disconnect();
  }

  async get<T>(userId: string, type: 'providers' | 'services'): Promise<T | null> {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const raw = await this.redis.get(`${RECOMMENDATION_CACHE_PREFIX}${userId}:${type}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null; // cache is best-effort; a miss just means recompute
    }
  }

  async set(userId: string, type: 'providers' | 'services', entityIds: string[], payload: unknown) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.set(
        `${RECOMMENDATION_CACHE_PREFIX}${userId}:${type}`,
        JSON.stringify(payload),
        'EX',
        RECOMMENDATION_CACHE_TTL_SECONDS,
      );
    } catch {
      /* best-effort */
    }

    const expiresAt = new Date(Date.now() + RECOMMENDATION_CACHE_TTL_SECONDS * 1000);
    await this.prisma.recommendationCache
      .upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, entityIds, expiresAt },
        update: { entityIds, generatedAt: new Date(), expiresAt },
      })
      .catch(() => undefined);
  }

  async invalidate(userId: string) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      await this.redis.del(
        `${RECOMMENDATION_CACHE_PREFIX}${userId}:providers`,
        `${RECOMMENDATION_CACHE_PREFIX}${userId}:services`,
      );
    } catch {
      /* best-effort */
    }
  }
}
