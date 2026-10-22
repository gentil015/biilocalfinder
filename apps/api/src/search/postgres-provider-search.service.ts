import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchProvidersDto } from './dto/search-providers.dto';
import {
  ProviderSearchResult,
  ProviderSearchService,
} from './provider-search.interface';
import { RuleBasedRankingService } from './rule-based-ranking.service';
import { EMBEDDING_PROVIDER, EmbeddingProvider } from './embedding/embedding-provider.interface';
import { toVectorLiteral } from './embedding/embedding-index.service';

// Below this many characters a query is almost never worth an embeddings
// call (single letters, stray whitespace) — skip straight to keyword-only.
const MIN_QUERY_LENGTH_FOR_SEMANTIC = 3;

// Cosine distance (0 = identical, 2 = opposite) above which a provider's
// best-matching offering is considered unrelated to the query, so it isn't
// pulled in by the semantic OR-clause. Permissive by design — this is a
// recall booster on top of keyword search, not a replacement for it, and a
// false positive here just gets outranked by keyword matches, not shown
// instead of them (spec: still combined via OR).
const SEMANTIC_MAX_DISTANCE = Number(process.env.SEMANTIC_SEARCH_MAX_DISTANCE ?? 0.6);

// Builds a safe, OR-joined, prefix-matching tsquery from free text — e.g.
// "wedding photographer" -> "wedding:* | photographer:*", so a provider
// matches on ANY word overlap rather than needing every word to hit (and
// rather than needing the literal phrase in one column, which was the
// bug: search only ever checked businessName, so "wedding photographer"
// never found a provider named "ABC Creative Studio" offering "Wedding
// Photography"). Tokens are stripped to alphanumerics before being handed
// to to_tsquery, so malformed input can never produce invalid tsquery
// syntax or inject anything — to_tsquery still receives its argument as a
// bound parameter either way.
export function buildOrTsQuery(q: string): string | null {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `${t}:*`).join(' | ');
}

interface Row {
  id: string;
  businessName: string;
  avatarUrl: string | null;
  rating: Prisma.Decimal;
  reviewCount: number;
  verifiedReviewCount: number;
  verificationStatus: string;
  businessVerified: boolean;
  availabilityStatus: string;
  subscriptionStatus: string;
  responseRate: Prisma.Decimal;
  yearsOfExperience: number;
  responseTimeMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  serves_area: boolean | null;
  starting_price: Prisma.Decimal | null;
  semantic_distance: number | null;
  total_count: bigint;
}

// MVP search implementation: Postgres full-text search across provider
// name, service name/description, category name, and offering title/
// description (spec: "wedding photographer" should find a provider named
// "ABC Creative Studio" offering "Wedding Photography") plus PostGIS
// ST_DWithin/ST_Distance for radius search — no in-JS distance math, per
// spec §10. Ranking (spec §9) is delegated to a separate service so it
// can be swapped for an ML ranker later without touching this class's
// callers.
@Injectable()
export class PostgresProviderSearchService implements ProviderSearchService {
  private readonly logger = new Logger(PostgresProviderSearchService.name);

  // Tri-state on purpose: `undefined` = not probed yet, so the first search
  // awaits the probe. A resolved promise is kept so every later request
  // reuses it instead of re-querying the catalog.
  private semanticSupportProbe: Promise<boolean> | undefined;
  private geoSupportProbe: Promise<boolean> | undefined;

  constructor(
    private prisma: PrismaService,
    private ranking: RuleBasedRankingService,
    @Inject(EMBEDDING_PROVIDER) private embeddingProvider: EmbeddingProvider,
  ) {}

  /**
   * Whether this database can actually serve semantic search — i.e. the
   * `vector` extension is installed AND `service_offerings.embedding` exists.
   *
   * Semantic ranking is an optional recall booster layered on top of keyword
   * search, so the search SQL must be able to run without it. The column and
   * the extension come from a migration that is not applied on every
   * deployment (a plain `postgres` image has neither pgvector nor the
   * column), and the search query is raw SQL that Prisma cannot type-check —
   * so without this probe a keyword search on such a database fails the whole
   * request with `column ... does not exist` instead of just skipping the
   * semantic branch. Cached for the process lifetime; the schema does not
   * change while the API is running.
   */
  private async hasSemanticSupport(): Promise<boolean> {
    if (!this.semanticSupportProbe) {
      this.semanticSupportProbe = (async () => {
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
          const ok = rows[0]?.ok === true;
          if (!ok) {
            this.logger.warn(
              'Semantic search disabled: pgvector and/or service_offerings.embedding ' +
                'is missing. Falling back to keyword-only search — run the pgvector ' +
                'migration to enable it.',
            );
          }
          return ok;
        } catch (err) {
          // A probe failure must never be the reason search 500s.
          this.logger.warn(
            `Semantic support probe failed, falling back to keyword-only search: ${(err as Error).message}`,
          );
          return false;
        }
      })();
    }
    return this.semanticSupportProbe;
  }

  /**
   * Whether this database can actually serve radius search — i.e. PostGIS is
   * installed AND the `geography(Point, 4326)` columns the schema documents as
   * migration-managed actually exist on `locations` and `service_areas`.
   *
   * Same reasoning as hasSemanticSupport: Prisma has no geography type, so
   * these columns are created by raw SQL outside the schema, which means the
   * search service cannot assume they are there. A plain `postgres` image has
   * neither. When this is false the lat/lng filter is dropped and the caller
   * gets ordinary keyword results rather than a 500 — the same behaviour as a
   * search with no coordinates at all.
   */
  private async hasGeoSupport(): Promise<boolean> {
    if (!this.geoSupportProbe) {
      this.geoSupportProbe = (async () => {
        try {
          // `locations.geom` is the provider's home base (joined as `l` below)
          // and `service_areas.geom` is each drawn coverage circle — those are
          // the only two geography columns the radius query reads.
          const rows = await this.prisma.$queryRaw<{ ok: boolean }[]>`
            SELECT (
              EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis')
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'locations' AND column_name = 'geom'
              )
              AND EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'service_areas' AND column_name = 'geom'
              )
            ) AS ok
          `;
          const ok = rows[0]?.ok === true;
          if (!ok) {
            this.logger.warn(
              'Radius search disabled: PostGIS and/or the locations/service_areas ' +
                'geography columns are missing. Coordinates are ignored — run the ' +
                'PostGIS migration to enable radius search.',
            );
          }
          return ok;
        } catch (err) {
          this.logger.warn(
            `Geo support probe failed, ignoring coordinates: ${(err as Error).message}`,
          );
          return false;
        }
      })();
    }
    return this.geoSupportProbe;
  }

  async search(params: SearchProvidersDto): Promise<ProviderSearchResult> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;
    // Coordinates only take effect if the database can actually do radius
    // search. Probed once per process; when unsupported they are treated as
    // absent so the query below never references PostGIS columns or functions.
    const geoSupported = params.lat != null && params.lng != null && (await this.hasGeoSupport());
    const hasGeo = geoSupported;

    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."verificationStatus" != 'SUSPENDED'`,
      // Never surface a profile still mid-onboarding (spec: "Prevent
      // incomplete provider profiles from being published publicly").
      // Pre-existing providers were backfilled to COMPLETED by
      // manual-sql/007_provider_onboarding.sql, so this doesn't hide
      // anyone who was already live before onboarding existed.
      Prisma.sql`p."onboardingStep" = 'COMPLETED'`,
    ];

    // Populated below when params.q is set and embedding a query succeeds;
    // used both in the WHERE clause (semantic OR-match) and the SELECT list
    // (semantic_distance, fed into ranking) further down.
    let queryVectorLiteral: string | null = null;

    // Probed once per process. When false, the query embedding is never
    // requested and neither the WHERE nor the SELECT list below references
    // the `embedding` column, so keyword search runs exactly as it did before
    // semantic search existed.
    const semanticSupported = params.q ? await this.hasSemanticSupport() : false;

    if (params.q) {
      const tsQuery = buildOrTsQuery(params.q);
      const textClause = tsQuery
        ? Prisma.sql`(
            to_tsvector('english', p."businessName") @@ to_tsquery('english', ${tsQuery})
            OR EXISTS (
              SELECT 1 FROM service_offerings so_q
              JOIN services sv_q ON sv_q.id = so_q."serviceId"
              JOIN service_categories cat_q ON cat_q.id = sv_q."categoryId"
              WHERE so_q."providerId" = p.id
                AND so_q."isActive" = true
                AND to_tsvector('english',
                      coalesce(sv_q.name, '') || ' ' || coalesce(sv_q.description, '') || ' ' ||
                      coalesce(cat_q.name, '') || ' ' ||
                      coalesce(so_q.title, '') || ' ' || coalesce(so_q.description, '')
                    ) @@ to_tsquery('english', ${tsQuery})
            )
          )`
        : null;

      // Semantic recall on top of keyword matching (never instead of it):
      // "leaking tap in the kitchen" has almost no word overlap with a
      // listing titled "Emergency Plumbing Repairs", so the tsquery branch
      // above would miss it entirely. Embedding the query is best-effort —
      // tryEmbedQuery never throws, and a failed/unconfigured/slow call
      // just means this OR-branch is skipped and keyword search still runs
      // normally, exactly as before this feature existed.
      const queryEmbedding = semanticSupported ? await this.tryEmbedQuery(params.q) : null;
      const semanticClause = queryEmbedding
        ? (() => {
            queryVectorLiteral = toVectorLiteral(queryEmbedding);
            return Prisma.sql`EXISTS (
              SELECT 1 FROM service_offerings so_sem
              WHERE so_sem."providerId" = p.id
                AND so_sem."isActive" = true
                AND so_sem.embedding IS NOT NULL
                AND so_sem.embedding <=> ${queryVectorLiteral}::vector < ${SEMANTIC_MAX_DISTANCE}
            )`;
          })()
        : null;

      if (textClause && semanticClause) {
        conditions.push(Prisma.sql`(${textClause} OR ${semanticClause})`);
      } else if (textClause) {
        conditions.push(textClause);
      } else if (semanticClause) {
        conditions.push(semanticClause);
      }
      // If q was given but neither tsQuery nor an embedding could be
      // built (e.g. "!!!" alone), no condition is pushed at all — same
      // fully-permissive behavior buildOrTsQuery already had on its own
      // before semantic search existed.
    }
    if (params.serviceId) {
      conditions.push(
        // No ::uuid cast — this schema stores ids as text.
        Prisma.sql`EXISTS (SELECT 1 FROM service_offerings ps2 WHERE ps2."providerId" = p.id AND ps2."serviceId" = ${params.serviceId} AND ps2."isActive" = true)`,
      );
    }
    if (params.categoryId) {
      conditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM service_offerings ps3
          JOIN services s3 ON s3.id = ps3."serviceId"
          WHERE ps3."providerId" = p.id AND s3."categoryId" = ${params.categoryId} AND ps3."isActive" = true
        )`,
      );
    }
    if (params.minRating != null) {
      conditions.push(Prisma.sql`p.rating >= ${params.minRating}`);
    }
    if (params.minExperience != null) {
      conditions.push(Prisma.sql`p."yearsOfExperience" >= ${params.minExperience}`);
    }
    if (params.availableNow) {
      conditions.push(Prisma.sql`p."availabilityStatus" = 'AVAILABLE'`);
    }
    if (params.verifiedOnly) {
      conditions.push(Prisma.sql`p."verificationStatus" = 'VERIFIED'`);
    }
    if (hasGeo) {
      // A provider matches if the query point is within the general search
      // radius of their home base, OR falls inside one of their drawn
      // coverage circles (spec §12 "Serves your area") — a provider based
      // 40km away who explicitly covers the query's neighborhood should
      // still show up even if the blanket radius filter wouldn't catch them.
      conditions.push(
        Prisma.sql`(
          (l.geom IS NOT NULL AND ST_DWithin(l.geom, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography, ${(params.radiusKm ?? 15) * 1000}))
          OR EXISTS (
            SELECT 1 FROM service_areas sa_q
            WHERE sa_q."providerId" = p.id
              AND sa_q.geom IS NOT NULL
              AND ST_DWithin(sa_q.geom, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography, sa_q."radiusKm" * 1000)
          )
        )`,
      );
    }

    const priceHaving: any[] = [];
    if (params.minPrice != null) priceHaving.push(Prisma.sql`MIN(ps."basePrice") >= ${params.minPrice}`);
    if (params.maxPrice != null) priceHaving.push(Prisma.sql`MIN(ps."basePrice") <= ${params.maxPrice}`);
    const havingClause: any = priceHaving.length ? Prisma.sql`HAVING ${Prisma.join(priceHaving, ' AND ')}` : Prisma.sql``;

    // Dynamic category-attribute filters (spec §16-17) — resolved to a set
    // of validated EXISTS clauses before conditions is finalized. Only
    // attributes marked isFilterable on the resolved category are ever
    // honored; anything else is rejected outright rather than silently
    // ignored (spec §17: "do not blindly trust arbitrary attribute names").
    if (params.attributes && Object.keys(params.attributes).length > 0) {
      conditions.push(...(await this.attributeFilterClauses(params)));
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const distanceExpr = hasGeo
      ? Prisma.sql`CASE WHEN l.geom IS NOT NULL THEN ST_Distance(l.geom, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography) / 1000.0 ELSE NULL END`
      : Prisma.sql`NULL`;

    // Distinguishes "near their home base" from "explicitly covers this
    // spot" for display (a "Serves your area" badge is a stronger signal
    // than plain proximity).
    const servesAreaExpr = hasGeo
      ? Prisma.sql`EXISTS (
          SELECT 1 FROM service_areas sa_sel
          WHERE sa_sel."providerId" = p.id
            AND sa_sel.geom IS NOT NULL
            AND ST_DWithin(sa_sel.geom, ST_SetSRID(ST_MakePoint(${params.lng}, ${params.lat}), 4326)::geography, sa_sel."radiusKm" * 1000)
        )`
      : Prisma.sql`NULL`;

    const orderClause = this.orderClauseFor(params.sort, hasGeo);

    // Best (smallest) distance among this provider's own indexed offerings
    // — a per-row scalar subquery rather than a join, so it doesn't fan
    // out the GROUP BY when a provider has several offerings. NULL when
    // there was no query embedding at all, or none of this provider's
    // offerings have been indexed yet.
    const semanticDistanceExpr = queryVectorLiteral
      ? Prisma.sql`(
          SELECT MIN(so_dist.embedding <=> ${queryVectorLiteral}::vector)
          FROM service_offerings so_dist
          WHERE so_dist."providerId" = p.id
            AND so_dist."isActive" = true
            AND so_dist.embedding IS NOT NULL
        )`
      : Prisma.sql`NULL`;

    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT
        p.id,
        p."businessName",
        COALESCE(p."logoUrl", u."avatarUrl") AS "avatarUrl",
        p.rating,
        p."reviewCount",
        p."verifiedReviewCount",
        p."verificationStatus",
        p."businessVerified",
        p."availabilityStatus",
        p."subscriptionStatus",
        p."responseRate",
        p."yearsOfExperience",
        p."responseTimeMinutes",
        l.latitude,
        l.longitude,
        ${distanceExpr} AS distance_km,
        ${servesAreaExpr} AS serves_area,
        MIN(ps."basePrice") AS starting_price,
        ${semanticDistanceExpr} AS semantic_distance,
        COUNT(*) OVER() AS total_count
      FROM providers p
      JOIN users u ON u.id = p."userId"
      LEFT JOIN locations l ON l.id = p."locationId"
      LEFT JOIN service_offerings ps ON ps."providerId" = p.id AND ps."isActive" = true
      WHERE ${whereClause}
      GROUP BY p.id, u."avatarUrl", l.latitude, l.longitude, l.geom
      ${havingClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const items = rows.map((r: Row) => {
      const distanceKm = r.distance_km != null ? Number(r.distance_km) : null;
      const rating = Number(r.rating);
      const responseRate = Number(r.responseRate);
      // Cosine distance (0..2) -> similarity (0..1), clamped: a provider
      // with no indexed offering yet has semantic_distance NULL, which
      // must stay null/undefined here rather than becoming 0 — RankableProvider's
      // contract is that "no signal" and "no match" are different things.
      const semanticScore =
        r.semantic_distance != null ? Math.max(0, Math.min(1, 1 - Number(r.semantic_distance) / 2)) : null;
      const score = this.ranking.score({
        id: r.id,
        distanceKm,
        rating,
        availabilityStatus: r.availabilityStatus,
        responseRate,
        yearsOfExperience: r.yearsOfExperience,
        verificationStatus: r.verificationStatus,
        subscriptionStatus: r.subscriptionStatus,
        semanticScore,
      });
      return {
        id: r.id,
        businessName: r.businessName,
        avatarUrl: r.avatarUrl,
        rating,
        reviewCount: r.reviewCount,
        verifiedReviewCount: r.verifiedReviewCount,
        verificationStatus: r.verificationStatus,
        businessVerified: r.businessVerified,
        availabilityStatus: r.availabilityStatus,
        yearsOfExperience: r.yearsOfExperience,
        responseTimeMinutes: r.responseTimeMinutes,
        distanceKm,
        servesArea: r.serves_area ?? null,
        startingPrice: r.starting_price != null ? Number(r.starting_price) : null,
        currency: 'RWF',
        latitude: r.latitude,
        longitude: r.longitude,
        score,
      };
    });

    if (params.sort === 'recommended' || !params.sort) {
      items.sort((a: (typeof items)[number], b: (typeof items)[number]) => b.score - a.score);
    }

    return {
      items,
      total: rows.length ? Number(rows[0].total_count) : 0,
      page,
      limit,
    };
  }

  // Resolves attributes[slug]=value query params into validated EXISTS
  // clauses. Needs a categoryId to scope which attributes are legal —
  // taken directly from params.categoryId, or looked up from
  // params.serviceId — since "droneAvailable" is meaningless without
  // knowing which category's attribute list to check it against.
  private async attributeFilterClauses(params: SearchProvidersDto): Promise<Prisma.Sql[]> {
    let categoryId = params.categoryId;
    if (!categoryId && params.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: params.serviceId } });
      categoryId = service?.categoryId;
    }
    if (!categoryId) {
      throw new BadRequestException('Attribute filters require a serviceId or categoryId');
    }

    const slugs = Object.keys(params.attributes ?? {});
    const attributes: { id: string; slug: string; type: string }[] = await this.prisma.categoryAttribute.findMany({
      where: { categoryId, slug: { in: slugs }, isFilterable: true, isActive: true },
    });
    const bySlug = new Map(attributes.map((a) => [a.slug, a]));

    const clauses: Prisma.Sql[] = [];
    for (const [slug, rawValue] of Object.entries(params.attributes ?? {})) {
      const attribute = bySlug.get(slug);
      if (!attribute) {
        // Reject rather than silently ignore — spec §17.
        throw new BadRequestException(`"${slug}" is not a filterable attribute for this category`);
      }

      const valueClause = this.attributeValueMatchClause(attribute.type, rawValue);
      clauses.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM service_offering_attribute_values v
          JOIN service_offerings so ON so.id = v."serviceOfferingId"
          WHERE so."providerId" = p.id
            AND so."isActive" = true
            AND v."categoryAttributeId" = ${attribute.id}
            AND ${valueClause}
        )`,
      );
    }
    return clauses;
  }

  private attributeValueMatchClause(type: string, rawValue: string): Prisma.Sql {
    switch (type) {
      case 'BOOLEAN':
        return Prisma.sql`v."booleanValue" = ${rawValue === 'true'}`;
      case 'NUMBER':
      case 'PRICE': {
        const num = Number(rawValue);
        if (Number.isNaN(num)) throw new BadRequestException('Invalid numeric attribute filter value');
        return Prisma.sql`v."numberValue" = ${num}`;
      }
      case 'MULTI_SELECT':
        return Prisma.sql`v."jsonValue" @> ${JSON.stringify([rawValue])}::jsonb`;
      case 'SELECT':
      case 'TEXT':
      default:
        return Prisma.sql`v."textValue" = ${rawValue}`;
    }
  }

  // Best-effort only. Swallows anything the provider itself doesn't
  // already swallow (see EmbeddingProvider's own contract), and enforces
  // the length floor — semantic search must never turn a slow/unavailable
  // vendor, or a query too short to embed meaningfully, into a broken or
  // slowed-down keyword search.
  private async tryEmbedQuery(q: string): Promise<number[] | null> {
    const trimmed = q.trim();
    if (trimmed.length < MIN_QUERY_LENGTH_FOR_SEMANTIC) return null;
    try {
      return await this.embeddingProvider.embed(trimmed, 'query');
    } catch (err) {
      this.logger.warn(`Query embedding failed, falling back to keyword-only: ${(err as Error).message}`);
      return null;
    }
  }

  private orderClauseFor(sort: SearchProvidersDto['sort'], hasGeo: boolean): Prisma.Sql {
    switch (sort) {
      case 'nearest':
        return hasGeo ? Prisma.sql`ORDER BY distance_km ASC NULLS LAST` : Prisma.sql`ORDER BY p.rating DESC`;
      case 'highest_rated':
        return Prisma.sql`ORDER BY p.rating DESC`;
      case 'lowest_price':
        return Prisma.sql`ORDER BY starting_price ASC NULLS LAST`;
      case 'most_experienced':
        return Prisma.sql`ORDER BY p."yearsOfExperience" DESC`;
      case 'available_now':
        return Prisma.sql`ORDER BY (p."availabilityStatus" = 'AVAILABLE') DESC, p.rating DESC`;
      default:
        // 'recommended' — fetched unordered here, then ranked in JS by score
        // (weights live in RuleBasedRankingService, not in SQL).
        return Prisma.sql`ORDER BY p.rating DESC`;
    }
  }
}
