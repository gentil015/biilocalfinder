import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmbeddingIndexService, toVectorLiteral } from '../search/embedding/embedding-index.service';
import { buildOrTsQuery } from '../search/postgres-provider-search.service';
import {
  MatchRequestContext,
  MatchScoreComponents,
  MatchableOffering,
  MatchableProvider,
  ProviderMatchType,
  buildCategoryDistances,
  scoreProviderMatch,
  tokenize,
} from './provider-matching.scoring';

export const PROVIDER_MATCHING_QUEUE = 'service-request-matching';

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function envFloat(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

// A request that has stopped taking quotes shouldn't suddenly notify a new
// wave of providers if a queued job runs after the client cancelled it.
const ACCEPTING_STATUSES = ['OPEN', 'QUOTED', 'NEGOTIATING'] as const;

const MIN_MATCH_SCORE = envInt('REQUEST_MATCH_MIN_SCORE', 30);
const MAX_NOTIFIED_PROVIDERS = envInt('REQUEST_MATCH_MAX_PROVIDERS', 100);
const RELATED_CATEGORY_DEPTH = envInt('REQUEST_MATCH_RELATED_CATEGORY_DEPTH', 2);
const SEMANTIC_MAX_DISTANCE = envFloat('REQUEST_MATCH_SEMANTIC_MAX_DISTANCE', 0.6);
const SEMANTIC_CANDIDATE_LIMIT = envInt('REQUEST_MATCH_SEMANTIC_CANDIDATES', 250);
const KEYWORD_CANDIDATE_LIMIT = envInt('REQUEST_MATCH_KEYWORD_CANDIDATES', 250);
const EXACT_OFFERING_LIMIT = envInt('REQUEST_MATCH_EXACT_LIMIT', 1000);
const RELATED_OFFERING_LIMIT = envInt('REQUEST_MATCH_RELATED_LIMIT', 750);
const MAX_REQUEST_TEXT_LENGTH = 2000;

const OFFERING_SELECT = {
  id: true,
  providerId: true,
  serviceId: true,
  title: true,
  description: true,
  basePrice: true,
  service: {
    select: {
      name: true,
      description: true,
      categoryId: true,
      category: { select: { id: true, name: true } },
    },
  },
} as const;

const PROVIDER_SELECT = {
  id: true,
  userId: true,
  businessName: true,
  rating: true,
  reviewCount: true,
  verificationStatus: true,
  businessVerified: true,
  availabilityStatus: true,
  subscriptionStatus: true,
  yearsOfExperience: true,
  responseRate: true,
  responseTimeMinutes: true,
  serviceRadiusKm: true,
  location: { select: { latitude: true, longitude: true } },
  serviceAreas: { select: { latitude: true, longitude: true, radiusKm: true } },
} as const;

export interface RequestForMatching {
  id: string;
  title: string;
  description: string;
  serviceId: string;
  providerId: string | null;
  isPublic: boolean;
  status: string;
  preferredDate: Date | null;
  budgetMin: Prisma.Decimal | null;
  budgetMax: Prisma.Decimal | null;
  service: {
    id: string;
    name: string;
    description: string | null;
    categoryId: string;
    category: { id: string; name: string };
  };
  client: { userId: string };
  location: { latitude: number; longitude: number } | null;
  attributeSnapshots: Array<{ attributeName: string; attributeValue: string }>;
}

type RawOffering = Prisma.ServiceOfferingGetPayload<{ select: typeof OFFERING_SELECT }>;
type RawProvider = Prisma.ProviderGetPayload<{ select: typeof PROVIDER_SELECT }>;

export interface ProviderMatch {
  providerId: string;
  userId: string;
  businessName: string;
  provider: MatchableProvider;
  offering: MatchableOffering;
  score: number;
  matchType: ProviderMatchType;
  reasons: string[];
  components: MatchScoreComponents;
  distanceKm: number | null;
  servesArea: boolean | null;
}

export interface MatchRunResult {
  requestId: string;
  candidateCount: number;
  matchedCount: number;
  notifiedCount: number;
  matches: ProviderMatch[];
}

@Injectable()
export class ProviderMatchingService {
  private readonly logger = new Logger(ProviderMatchingService.name);

  // Tri-state capability probe, same pattern as PostgresProviderSearchService:
  // the pgvector column is added by raw SQL, so a deployment without the
  // migration must fall back to keyword/category matching, never 500.
  private vectorSupportProbe: Promise<boolean> | undefined;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private embeddingIndex: EmbeddingIndexService,
    @InjectQueue(PROVIDER_MATCHING_QUEUE) private queue: Queue<{ requestId: string }>,
  ) {}

  // Called from the request write path. Deliberately fire-and-forget: the
  // client's POST returns as soon as the request exists; identifying and
  // notifying dozens of providers is a background concern. A duplicate
  // requestId is ignored while the same job is still pending.
  async enqueue(requestId: string): Promise<void> {
    try {
      await this.queue.add(
        'match-request',
        { requestId },
        {
          jobId: `request-match:${requestId}`,
          attempts: 2,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.warn(`Could not enqueue provider matching for request ${requestId}: ${(err as Error).message}`);
    }
  }

  async matchAndNotify(requestId: string): Promise<MatchRunResult> {
    const empty: MatchRunResult = {
      requestId,
      candidateCount: 0,
      matchedCount: 0,
      notifiedCount: 0,
      matches: [],
    };

    const request = await this.loadRequest(requestId);
    if (!request) return empty;

    // A private direct request is addressed to one provider only. The
    // matcher's entire job is the marketplace-visible case: a broadcast
    // (providerId null) or a direct request the client explicitly opened
    // (isPublic). Anyone else must never be notified.
    if (request.providerId && !request.isPublic) return empty;

    const matches = await this.findMatches(request);
    const excludedProviderIds = new Set<string>(request.providerId ? [request.providerId] : []);
    const eligible = matches.filter((match) => !excludedProviderIds.has(match.providerId));

    const selected = this.selectRecipients(eligible);
    const alreadyNotified = await this.alreadyNotifiedUserIds(request.id);

    // A user can own more than one matching provider (multi-provider
    // workspace). Notification is per user, so keep the highest-scoring
    // provider — the inbox will still show every matching request.
    const toNotify = selected.filter((match) => !alreadyNotified.has(match.userId));

    // Persist the selected matches first: the inbox, request detail view and
    // quote endpoint all use this table to decide whether a related-category
    // provider is a legitimate participant. Notifications are just the nudge;
    // this row is the durable authorization.
    await this.persistMatches(request.id, selected);

    const preferredDate = request.preferredDate
      ? request.preferredDate.toISOString().slice(0, 10)
      : null;
    const budget =
      request.budgetMin != null && request.budgetMax != null
        ? `${Number(request.budgetMin).toLocaleString()}–${Number(request.budgetMax).toLocaleString()} RWF`
        : request.budgetMax != null
          ? `Up to ${Number(request.budgetMax).toLocaleString()} RWF`
          : request.budgetMin != null
            ? `From ${Number(request.budgetMin).toLocaleString()} RWF`
            : null;
    const requestDetails = [
      preferredDate ? `Date ${preferredDate}` : null,
      budget ? `Budget ${budget}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    if (toNotify.length > 0) {
      await this.notifications.notifyMany(
        toNotify.map((match) => {
          const title =
            match.matchType === 'EXACT_SERVICE'
              ? `New ${request.service.name} request matches your service`
              : 'New request related to your services';
          const preview = request.title.trim().slice(0, 140);
          const reason = match.reasons.slice(0, 2).join(' · ');

          return {
            userId: match.userId,
            type: 'NEW_SERVICE_REQUEST' as const,
            title,
            body: [preview, requestDetails, reason].filter(Boolean).join(' — '),
            data: {
              requestId: request.id,
              serviceId: request.serviceId,
              serviceName: request.service.name,
              providerId: match.providerId,
              matchType: match.matchType,
              matchScore: match.score,
              matchReasons: match.reasons,
              distanceKm: match.distanceKm,
              preferredDate,
              budgetMin: request.budgetMin != null ? Number(request.budgetMin) : null,
              budgetMax: request.budgetMax != null ? Number(request.budgetMax) : null,
            },
          };
        }),
      );
      await this.prisma.serviceRequestProviderMatch.updateMany({
        where: {
          serviceRequestId: request.id,
          providerId: { in: toNotify.map((match) => match.providerId) },
        },
        data: { notifiedAt: new Date() },
      });
    }

    this.logger.log(
      `Request ${requestId}: ${matches.length} candidate match(es), ` +
        `${selected.length} selected, ${toNotify.length} provider(s) notified`,
    );

    return {
      requestId,
      candidateCount: matches.length,
      matchedCount: selected.length,
      notifiedCount: toNotify.length,
      matches: selected,
    };
  }

  // All scored provider matches for a request, strongest first. Exposed so
  // future surfaces (admin analytics, "why did this provider see this?") can
  // use the same ranking without notifying anyone.
  async findMatches(request: RequestForMatching): Promise<ProviderMatch[]> {
    const categories = await this.prisma.serviceCategory.findMany({
      select: { id: true, parentId: true },
    });
    const categoryDistances = buildCategoryDistances(request.service.categoryId, categories);
    const relatedCategoryIds = [...categoryDistances.entries()]
      .filter(([, distance]) => distance <= RELATED_CATEGORY_DEPTH)
      .map(([id]) => id);

    const requestText = this.buildRequestText(request);
    const requestTokens = tokenize(requestText);
    const semantic = await this.semanticCandidates(requestText);
    const keywordIds = await this.keywordCandidates(requestText);

    const offerings = await this.loadCandidateOfferings(
      request.serviceId,
      relatedCategoryIds,
      new Set([...semantic.distances.keys(), ...keywordIds]),
    );
    if (offerings.size === 0) return [];

    const providers = await this.loadEligibleProviders(
      [...new Set([...offerings.values()].map((offering) => offering.providerId))],
      request.client.userId,
    );
    if (providers.size === 0) return [];

    const contextBase = {
      serviceId: request.serviceId,
      text: requestText,
      tokens: requestTokens,
      categoryDistances,
      location: request.location
        ? { latitude: request.location.latitude, longitude: request.location.longitude }
        : null,
      budgetMin: request.budgetMin != null ? Number(request.budgetMin) : null,
      budgetMax: request.budgetMax != null ? Number(request.budgetMax) : null,
    };

    // Keep only the strongest offering per provider: a provider with ten
    // offerings should be one notification, not ten, and the best-matching
    // offering is the one that explains why they're relevant.
    const bestByProvider = new Map<string, ProviderMatch>();
    for (const rawOffering of offerings.values()) {
      const rawProvider = providers.get(rawOffering.providerId);
      if (!rawProvider) continue;

      const offering = this.toMatchableOffering(rawOffering);
      const provider = this.toMatchableProvider(rawProvider);
      const distance = semantic.distances.get(rawOffering.id);
      const semanticSimilarity =
        distance != null ? Math.max(0, Math.min(1, 1 - distance / 2)) : null;

      const context: MatchRequestContext = { ...contextBase, semanticSimilarity };
      const result = scoreProviderMatch(provider, offering, context);

      const existing = bestByProvider.get(provider.id);
      if (existing && existing.score >= result.score) continue;

      bestByProvider.set(provider.id, {
        providerId: provider.id,
        userId: provider.userId,
        businessName: provider.businessName,
        provider,
        offering,
        score: result.score,
        matchType: result.matchType,
        reasons: result.reasons,
        components: result.components,
        distanceKm: result.distanceKm,
        servesArea: result.servesArea,
      });
    }

    return [...bestByProvider.values()].sort((a, b) => b.score - a.score);
  }

  private selectRecipients(matches: ProviderMatch[]): ProviderMatch[] {
    const byUser = new Map<string, ProviderMatch>();

    for (const match of matches) {
      // Exact-service matches are always worth a notification, even if the
      // provider has a sparse profile (no rating/location yet) that keeps
      // their weighted score below the general relevance floor.
      if (match.matchType !== 'EXACT_SERVICE' && match.score < MIN_MATCH_SCORE) continue;

      const existing = byUser.get(match.userId);
      if (!existing || match.score > existing.score) byUser.set(match.userId, match);
    }

    return [...byUser.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, MAX_NOTIFIED_PROVIDERS));
  }

  private async loadRequest(requestId: string): Promise<RequestForMatching | null> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        title: true,
        description: true,
        serviceId: true,
        providerId: true,
        isPublic: true,
        status: true,
        preferredDate: true,
        budgetMin: true,
        budgetMax: true,
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            categoryId: true,
            category: { select: { id: true, name: true } },
          },
        },
        client: { select: { userId: true } },
        location: { select: { latitude: true, longitude: true } },
        attributeSnapshots: { select: { attributeName: true, attributeValue: true } },
      },
    });

    if (!request) return null;
    if (!ACCEPTING_STATUSES.includes(request.status as (typeof ACCEPTING_STATUSES)[number])) return null;
    return request;
  }

  private buildRequestText(request: RequestForMatching): string {
    const parts = [
      request.service.category.name,
      request.service.name,
      request.service.description,
      request.title,
      request.description,
      ...request.attributeSnapshots.map((a) => `${a.attributeName}: ${a.attributeValue}`),
    ];
    return parts
      .filter((part): part is string => !!part && part.trim().length > 0)
      .join('. ')
      .slice(0, MAX_REQUEST_TEXT_LENGTH);
  }

  private async loadCandidateOfferings(
    serviceId: string,
    relatedCategoryIds: string[],
    extraOfferingIds: Set<string>,
  ): Promise<Map<string, RawOffering>> {
    const [exact, related, extra] = await Promise.all([
      this.prisma.serviceOffering.findMany({
        where: { isActive: true, serviceId },
        select: OFFERING_SELECT,
        take: EXACT_OFFERING_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      relatedCategoryIds.length > 0
        ? this.prisma.serviceOffering.findMany({
            where: {
              isActive: true,
              serviceId: { not: serviceId },
              service: { categoryId: { in: relatedCategoryIds } },
            },
            select: OFFERING_SELECT,
            take: RELATED_OFFERING_LIMIT,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as RawOffering[]),
      extraOfferingIds.size > 0
        ? this.prisma.serviceOffering.findMany({
            where: { isActive: true, id: { in: [...extraOfferingIds] } },
            select: OFFERING_SELECT,
            take: extraOfferingIds.size,
          })
        : Promise.resolve([] as RawOffering[]),
    ]);

    const byId = new Map<string, RawOffering>();
    for (const offering of [...exact, ...related, ...extra]) byId.set(offering.id, offering);
    return byId;
  }

  private async loadEligibleProviders(
    providerIds: string[],
    excludeUserId: string,
  ): Promise<Map<string, RawProvider>> {
    if (providerIds.length === 0) return new Map();

    const providers = await this.prisma.provider.findMany({
      where: {
        id: { in: providerIds },
        userId: { not: excludeUserId },
        onboardingStep: 'COMPLETED',
        verificationStatus: { not: 'SUSPENDED' },
        workspace: { status: 'ACTIVE' },
        user: {
          status: 'ACTIVE',
          accountRestrictions: {
            none: {
              status: 'ACTIVE',
              restrictionType: {
                in: [
                  'PROVIDER_VISIBILITY_RESTRICTED',
                  'TEMPORARY_SUSPENSION',
                  'PERMANENT_SUSPENSION',
                ],
              },
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
          },
        },
      },
      select: PROVIDER_SELECT,
    });

    return new Map(providers.map((provider) => [provider.id, provider]));
  }

  private toMatchableOffering(offering: RawOffering): MatchableOffering {
    return {
      id: offering.id,
      serviceId: offering.serviceId,
      title: offering.title,
      description: offering.description,
      basePrice: offering.basePrice != null ? Number(offering.basePrice) : null,
      serviceName: offering.service.name,
      serviceDescription: offering.service.description,
      categoryId: offering.service.categoryId,
      categoryName: offering.service.category.name,
    };
  }

  private toMatchableProvider(provider: RawProvider): MatchableProvider {
    return {
      id: provider.id,
      userId: provider.userId,
      businessName: provider.businessName,
      rating: Number(provider.rating),
      reviewCount: provider.reviewCount,
      verificationStatus: provider.verificationStatus,
      businessVerified: provider.businessVerified,
      availabilityStatus: provider.availabilityStatus,
      subscriptionStatus: provider.subscriptionStatus,
      yearsOfExperience: provider.yearsOfExperience,
      responseRate: Number(provider.responseRate),
      responseTimeMinutes: provider.responseTimeMinutes,
      serviceRadiusKm: provider.serviceRadiusKm,
      location: provider.location
        ? { latitude: provider.location.latitude, longitude: provider.location.longitude }
        : null,
      serviceAreas: provider.serviceAreas.map((area) => ({
        latitude: area.latitude,
        longitude: area.longitude,
        radiusKm: area.radiusKm,
      })),
    };
  }

  private async hasVectorSupport(): Promise<boolean> {
    if (!this.vectorSupportProbe) {
      this.vectorSupportProbe = (async () => {
        try {
          const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
            SELECT (
              EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_offerings' AND column_name = 'embedding'
              )
            ) AS ok
          `;
          return rows[0]?.ok === true;
        } catch (err) {
          this.logger.warn(`Vector support probe failed: ${(err as Error).message}`);
          return false;
        }
      })();
    }
    return this.vectorSupportProbe;
  }

  // Semantic recall is additive: if pgvector is absent, the request has no
  // usable text, or the vendor call fails, category + keyword matching still
  // works exactly as before.
  private async semanticCandidates(
    requestText: string,
  ): Promise<{ distances: Map<string, number> }> {
    const distances = new Map<string, number>();
    if (requestText.trim().length < 3) return { distances };
    if (!(await this.hasVectorSupport())) return { distances };

    const vector = await this.embeddingIndex.embedQuery(requestText);
    if (!vector) return { distances };

    const literal = toVectorLiteral(vector);
    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string; distance: number }>>`
        SELECT so.id, (so.embedding <=> ${literal}::vector) AS distance
        FROM service_offerings so
        WHERE so."isActive" = true
          AND so.embedding IS NOT NULL
          AND so.embedding <=> ${literal}::vector < ${SEMANTIC_MAX_DISTANCE}
        ORDER BY distance ASC
        LIMIT ${SEMANTIC_CANDIDATE_LIMIT}
      `;
      for (const row of rows) distances.set(row.id, Number(row.distance));
    } catch (err) {
      this.vectorSupportProbe = Promise.resolve(false);
      this.logger.warn(`Semantic request matching disabled: ${(err as Error).message}`);
    }
    return { distances };
  }

  private async keywordCandidates(requestText: string): Promise<Set<string>> {
    const tsQuery = buildOrTsQuery(requestText.slice(0, 1000));
    if (!tsQuery) return new Set();

    try {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT so.id
        FROM service_offerings so
        JOIN services s ON s.id = so."serviceId"
        JOIN service_categories c ON c.id = s."categoryId"
        WHERE so."isActive" = true
          AND to_tsvector(
                'english',
                coalesce(c.name, '') || ' ' || coalesce(s.name, '') || ' ' ||
                coalesce(s.description, '') || ' ' ||
                coalesce(so.title, '') || ' ' || coalesce(so.description, '')
              ) @@ to_tsquery('english', ${tsQuery})
        ORDER BY ts_rank(
          to_tsvector(
            'english',
            coalesce(c.name, '') || ' ' || coalesce(s.name, '') || ' ' ||
            coalesce(s.description, '') || ' ' ||
            coalesce(so.title, '') || ' ' || coalesce(so.description, '')
          ),
          to_tsquery('english', ${tsQuery})
        ) DESC
        LIMIT ${KEYWORD_CANDIDATE_LIMIT}
      `;
      return new Set(rows.map((row) => row.id));
    } catch (err) {
      // A bad tsquery should never prevent the category-based fallback.
      this.logger.warn(`Keyword request matching skipped: ${(err as Error).message}`);
      return new Set();
    }
  }

  // Idempotency guard for BullMQ retries and for a direct request being
  // opened/cancelled/opened again: a provider already notified about this
  // request is not notified twice.
  private async alreadyNotifiedUserIds(requestId: string): Promise<Set<string>> {
    try {
      const rows = await this.prisma.notification.findMany({
        where: {
          type: 'NEW_SERVICE_REQUEST',
          data: { path: ['requestId'], equals: requestId },
        },
        select: { userId: true },
      });
      return new Set(rows.map((row) => row.userId));
    } catch {
      return new Set();
    }
  }

  private async persistMatches(requestId: string, matches: ProviderMatch[]): Promise<void> {
    if (matches.length === 0) return;

    try {
      // Re-check visibility at write time: the client may have closed
      // competition while this job was running. Grants must never outlive
      // the public window they were computed for.
      const current = await this.prisma.serviceRequest.findUnique({
        where: { id: requestId },
        select: { providerId: true, isPublic: true, status: true },
      });
      if (
        !current ||
        !ACCEPTING_STATUSES.includes(current.status as (typeof ACCEPTING_STATUSES)[number]) ||
        (current.providerId && !current.isPublic)
      ) {
        return;
      }

      await this.prisma.$transaction(
        matches.map((match) =>
          this.prisma.serviceRequestProviderMatch.upsert({
            where: {
              serviceRequestId_providerId: {
                serviceRequestId: requestId,
                providerId: match.providerId,
              },
            },
            create: {
              serviceRequestId: requestId,
              providerId: match.providerId,
              score: match.score,
              matchType: match.matchType,
              reasons: match.reasons as Prisma.InputJsonValue,
            },
            update: {
              score: match.score,
              matchType: match.matchType,
              reasons: match.reasons as Prisma.InputJsonValue,
            },
          }),
        ),
      );
    } catch (err) {
      // Access control falls back to the exact-service rule below if this
      // table is missing (older deployment), so notification must not be
      // lost just because match persistence failed.
      this.logger.warn(`Could not persist matches for request ${requestId}: ${(err as Error).message}`);
    }
  }
}
