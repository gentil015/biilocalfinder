import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CategoryAttribute } from '@prisma/client';
import { ServicesService } from '../services/services.service';
import { CategoriesService } from '../categories/categories.service';
import { ParseSearchDto } from './dto/parse-search.dto';
import { resolveRwandaLocation } from './rwanda-locations';
import {
  DEFAULT_SEARCH_ASSIST_LANGUAGE,
  isSearchAssistLanguage,
  SEARCH_ASSIST_PROVIDER,
  SearchAssistAttribute,
  SearchAssistLanguage,
  SearchAssistOutput,
  SearchAssistProvider,
} from './search-assist.interface';

// What the UI renders as removable-looking (but display-only) criteria pills.
// Each key is a translated label on the client; `value` is either a formatted,
// language-neutral string ("5,000–50,000 RWF", "4+", "urgent") or the
// category attribute's own database content for `key: 'attribute'` chips.
export type SearchChipKey =
  | 'service'
  | 'location'
  | 'urgency'
  | 'budget'
  | 'experience'
  | 'rating'
  | 'verified'
  | 'attribute';

export interface SearchChip {
  key: SearchChipKey;
  value: string;
  /** Attribute chips carry the attribute's display name (database content). */
  name?: string;
}

// Exactly the query parameters GET /api/search/providers accepts (see
// SearchProvidersDto) — anything else would be silently dropped by the
// global ValidationPipe, so the shape is deliberately identical.
export interface SearchFilters {
  q?: string;
  serviceId?: string;
  categoryId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  minRating?: number;
  minPrice?: number;
  maxPrice?: number;
  minExperience?: number;
  availableNow?: boolean;
  verifiedOnly?: boolean;
  sort: 'recommended';
}

export interface ParsedSearch {
  reply: string;
  language: SearchAssistLanguage;
  filters: SearchFilters;
  /** Attribute filters keyed by slug — the client sends them as attributes[slug]=value. */
  attributes?: Record<string, string>;
  chips: SearchChip[];
  suggestedCount: number;
  skippedCount: number;
}

const BUDGET_MAX = 10_000_000_000; // Decimal(12,2) ceiling — same bound as booking-assist
const EXPERIENCE_MAX = 60;
const SERVICE_NAME_MAX = 60;
const REPLY_MAX = 500;
const KEYWORD_MAX = 5;
const KEYWORD_LENGTH = 40;

interface CatalogEntry {
  serviceId: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  key: string;
  name: string;
}

@Injectable()
export class SearchAssistService {
  constructor(
    private servicesService: ServicesService,
    private categoriesService: CategoriesService,
    @Inject(SEARCH_ASSIST_PROVIDER) private provider: SearchAssistProvider,
  ) {}

  async parse(dto: ParseSearchDto): Promise<ParsedSearch> {
    const message = dto.message?.trim();
    if (!message) {
      throw new BadRequestException('Describe what you are looking for');
    }

    // The catalog is loaded fresh from the database: the model may only ever
    // select services that are really active right now, and it only ever sees
    // `${categorySlug}/${serviceSlug}` keys — never row ids.
    const services = await this.servicesService.findAll();
    const catalog: CatalogEntry[] = services.map((s) => ({
      serviceId: s.id,
      categoryId: s.categoryId,
      categorySlug: s.category.slug,
      categoryName: s.category.name,
      key: `${s.category.slug}/${s.slug}`,
      name: s.name,
    }));
    const byKey = new Map(catalog.map((c) => [c.key, c] as const));

    const { schema, rowsByCategory } = await this.loadAttributeSchema(catalog);

    const language = isSearchAssistLanguage(dto.language) ? dto.language : DEFAULT_SEARCH_ASSIST_LANGUAGE;

    const output = await this.provider.parse({
      language,
      message,
      services: catalog.map((c) => ({ key: c.key, name: c.name })),
      attributes: schema,
      locationHint:
        dto.lat != null && dto.lng != null
          ? { lat: dto.lat, lng: dto.lng, radiusKm: dto.radiusKm }
          : undefined,
    });

    return this.validate(output, { byKey, rowsByCategory, message, language, dto });
  }

  // Filterable public attributes for every category in the catalog — one
  // pass, because the model chooses the service and its criteria in the same
  // turn. Only filterable attributes are shown AND kept: the search engine
  // rejects non-filterable slugs outright (spec §17), so a dropped value is
  // a wrong guess, never a broken query.
  private async loadAttributeSchema(catalog: CatalogEntry[]) {
    const categoryIds = [...new Set(catalog.map((c) => c.categoryId))];
    const rowsByCategory = new Map<string, CategoryAttribute[]>();
    await Promise.all(
      categoryIds.map(async (categoryId) => {
        const rows = await this.categoriesService.getAttributesForCategory(categoryId, { publicOnly: true });
        rowsByCategory.set(
          categoryId,
          rows.filter((r) => r.isFilterable),
        );
      }),
    );

    const slugByCategoryId = new Map(catalog.map((c) => [c.categoryId, c.categorySlug] as const));
    const schema: SearchAssistAttribute[] = [];
    for (const [categoryId, rows] of rowsByCategory) {
      const categoryKey = slugByCategoryId.get(categoryId) ?? categoryId;
      for (const row of rows) {
        schema.push({
          categoryKey,
          slug: row.slug,
          name: row.name,
          type: row.type as SearchAssistAttribute['type'],
          options: (row.options as string[] | null) ?? null,
        });
      }
    }
    return { schema, rowsByCategory };
  }

  // The provider's output is untrusted no matter which vendor produced it.
  // Every field is checked against real data and the same limits the search
  // endpoint enforces; anything invalid is dropped and counted in
  // skippedCount instead of surfacing an error — a bad AI turn should never
  // break the search page, it just contributes fewer criteria.
  private validate(
    output: SearchAssistOutput,
    ctx: {
      byKey: Map<string, CatalogEntry>;
      rowsByCategory: Map<string, CategoryAttribute[]>;
      message: string;
      language: SearchAssistLanguage;
      dto: ParseSearchDto;
    },
  ): ParsedSearch {
    const filters: SearchFilters = { sort: 'recommended' };
    const chips: SearchChip[] = [];
    let attributes: Record<string, string> | undefined;
    let skipped = 0;

    // --- service ---------------------------------------------------------
    // An unknown/forged key never resolves to anything; the model is
    // offered a fixed list and may only copy from it.
    let service: CatalogEntry | undefined;
    if (typeof output.serviceKey === 'string') {
      service = ctx.byKey.get(output.serviceKey);
      if (service) {
        filters.serviceId = service.serviceId;
        filters.categoryId = service.categoryId;
      } else {
        skipped += 1;
      }
    }
    const serviceName =
      typeof output.serviceName === 'string' && output.serviceName.trim()
        ? this.cap(output.serviceName, SERVICE_NAME_MAX)
        : service?.name;
    if (serviceName) chips.push({ key: 'service', value: serviceName });

    // --- location --------------------------------------------------------
    // A named city wins over the searcher's own coordinates; an unresolvable
    // name is reported as skipped (there is no geocoder to ask). Scanning the
    // raw message is a fallback for a model that parsed but forgot to emit
    // the city — it can only ever resolve a known place from this list.
    const namedCity = typeof output.city === 'string' ? output.city : '';
    let place = resolveRwandaLocation(namedCity);
    if (!place && namedCity) skipped += 1;
    if (!place) place = resolveRwandaLocation(ctx.message);

    let lat: number | undefined;
    let lng: number | undefined;
    let radiusKm: number | undefined;
    if (place) {
      lat = place.lat;
      lng = place.lng;
      radiusKm = place.radiusKm;
      chips.push({ key: 'location', value: place.label });
    } else if (ctx.dto.lat != null && ctx.dto.lng != null) {
      // "Near me" fallback — only when no city was named at all.
      lat = ctx.dto.lat;
      lng = ctx.dto.lng;
      radiusKm = ctx.dto.radiusKm ?? 15;
    }
    if (lat != null && lng != null) {
      filters.lat = lat;
      filters.lng = lng;
      filters.radiusKm = radiusKm;
    }

    // --- urgency ---------------------------------------------------------
    // The only urgency the search engine understands is "free right now":
    // an urgent request becomes availableNow, anything else stays a plain
    // search. The chip is always shown so the client sees the criterion.
    const urgency = output.urgency === 'urgent' || output.urgency === 'asap' ? 'urgent' : 'normal';
    if (urgency === 'urgent') filters.availableNow = true;
    chips.push({ key: 'urgency', value: urgency });

    // --- budget ----------------------------------------------------------
    // `!= null` rather than `!== undefined`: a model that echoes back
    // "budgetMin": null is saying "no value", same as omitting the key —
    // only an actual present-but-invalid value counts as skipped.
    const min = this.validateMoney(output.budgetMin);
    const max = this.validateMoney(output.budgetMax);
    if (output.budgetMin != null && min === undefined) skipped += 1;
    if (output.budgetMax != null && max === undefined) skipped += 1;
    if (min !== undefined && max !== undefined && min > max) {
      skipped += 2; // inverted range is unusable — drop the pair, never guess which end is wrong
    } else {
      if (min !== undefined) filters.minPrice = min;
      if (max !== undefined) filters.maxPrice = max;
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      chips.push({ key: 'budget', value: this.formatBudget(filters.minPrice, filters.maxPrice) });
    }

    // --- experience / rating / verification ------------------------------
    const years = this.validateInt(output.minExperience, 0, EXPERIENCE_MAX);
    if (output.minExperience != null && years === undefined) skipped += 1;
    if (years !== undefined && years > 0) {
      filters.minExperience = years;
      chips.push({ key: 'experience', value: `${years}+` });
    }

    const rating = this.validateNumber(output.minRating, 1, 5);
    if (output.minRating != null && rating === undefined) skipped += 1;
    if (rating !== undefined) {
      filters.minRating = rating;
      chips.push({ key: 'rating', value: `${rating}+` });
    }

    if (output.verifiedOnly === true) {
      filters.verifiedOnly = true;
      chips.push({ key: 'verified', value: '' });
    } else if (output.verifiedOnly != null && typeof output.verifiedOnly !== 'boolean') {
      skipped += 1;
    }

    // --- free-text keywords ---------------------------------------------
    // Short expertise terms the service key does not cover ("cctv",
    // "security"). The search engine OR's tokens together, so a dropped or
    // malformed one only ever widens the result set, never breaks it.
    const q = this.sanitizeKeywords(output.keywords, namedCity ?? ctx.message);
    if (q) filters.q = q;

    // --- category attribute filters --------------------------------------
    // Legal only with a resolved service (the search engine needs a
    // serviceId/categoryId to scope slugs), only for that service's
    // category, only filterable, and every value re-run through the exact
    // same validateAttributeValue a manual filter submission hits.
    const values = output.values && typeof output.values === 'object' ? Object.entries(output.values) : [];
    if (values.length) {
      if (!service) {
        skipped += values.length; // attributes without a service belong to no category
      } else {
        const rows = ctx.rowsByCategory.get(service.categoryId) ?? [];
        const bySlug = new Map(rows.map((a) => [a.slug, a] as const));
        for (const [slug, rawValue] of values) {
          const attribute = bySlug.get(slug);
          if (!attribute) {
            skipped += 1;
            continue;
          }
          try {
            const normalized = this.categoriesService.validateAttributeValue(attribute, rawValue);
            const plain = this.denormalize(attribute.type, normalized);
            const filterValue = this.toFilterValue(attribute.type, plain);
            if (filterValue === undefined) {
              skipped += 1;
              continue;
            }
            attributes = attributes ?? {};
            attributes[slug] = filterValue;
            // The chip must show exactly what the search will filter on:
            // attributes[slug] holds ONE value per slug (MULTI_SELECT matches
            // by containment of a single element), so any extra requested
            // options are left out — and counted as such.
            chips.push({
              key: 'attribute',
              name: attribute.name,
              value: attribute.type === 'BOOLEAN' ? this.toChipValue(plain) : filterValue,
            });
            if (Array.isArray(plain) && plain.length > 1) skipped += plain.length - 1;
          } catch {
            skipped += 1;
          }
        }
      }
    }

    const reply =
      typeof output.reply === 'string' && output.reply.trim()
        ? this.cap(output.reply, REPLY_MAX)
        : this.defaultReply(ctx.language);

    return {
      reply,
      language: ctx.language,
      filters,
      ...(attributes ? { attributes } : {}),
      chips,
      suggestedCount: chips.length,
      skippedCount: skipped,
    };
  }

  // --- validators ----------------------------------------------------------

  private validateMoney(value: unknown): number | undefined {
    return this.validateNumber(value, 0, BUDGET_MAX);
  }

  private validateInt(value: unknown, min: number, max: number): number | undefined {
    const n = this.validateNumber(value, min, max);
    return n !== undefined && Number.isInteger(n) ? n : undefined;
  }

  private validateNumber(value: unknown, min: number, max: number): number | undefined {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n) || n < min || n > max) return undefined;
    return Math.round(n * 100) / 100;
  }

  // Terms come back lowercase, deduplicated, city-free, and capped — a
  // keyword can only be a search term, never a location or an essay.
  private sanitizeKeywords(keywords: unknown, message: string): string | undefined {
    if (!Array.isArray(keywords)) return undefined;
    const knownPlace = resolveRwandaLocation(message);
    const out: string[] = [];
    for (const raw of keywords) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const word = raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, KEYWORD_LENGTH);
      if (!word || out.includes(word)) continue;
      // A city name inside keywords would double-filter the location.
      if (resolveRwandaLocation(word) || (knownPlace && word.includes(knownPlace.label.toLowerCase()))) continue;
      out.push(word);
      if (out.length >= KEYWORD_MAX) break;
    }
    const joined = out.join(' ').trim();
    return joined || undefined;
  }

  private formatBudget(min: number | undefined, max: number | undefined): string {
    const f = (n: number) => n.toLocaleString('en-US');
    if (min !== undefined && max !== undefined) return `${f(min)}–${f(max)} RWF`;
    if (max !== undefined) return `≤${f(max)} RWF`;
    return `≥${f(min as number)} RWF`;
  }

  // validateAttributeValue() returns the normalized DB-column shape; convert
  // back to the plain value, then to the string form SearchProvidersDto
  // expects for `attributes[slug]=value` (Boolean → 'true'/'false', the
  // search SQL compares JSON containment for MULTI_SELECT with one element).
  private denormalize(type: string, normalized: ReturnType<CategoriesService['validateAttributeValue']>): unknown {
    switch (type) {
      case 'TEXT':
      case 'SELECT':
        return normalized.textValue;
      case 'NUMBER':
      case 'PRICE':
        return normalized.numberValue;
      case 'BOOLEAN':
        return normalized.booleanValue;
      case 'MULTI_SELECT':
        return normalized.jsonValue;
      default:
        return undefined;
    }
  }

  private toFilterValue(type: string, plain: unknown): string | undefined {
    if (plain === undefined || plain === null) return undefined;
    if (Array.isArray(plain)) {
      const first = plain[0];
      return first === undefined || first === null ? undefined : String(first);
    }
    if (type === 'BOOLEAN') return plain ? 'true' : 'false';
    if (type === 'NUMBER' || type === 'PRICE') {
      const n = Number(plain);
      return Number.isFinite(n) ? String(n) : undefined;
    }
    const text = String(plain);
    return text ? text : undefined;
  }

  private toChipValue(plain: unknown): string {
    if (Array.isArray(plain)) return plain.map((v) => String(v)).join(', ');
    if (typeof plain === 'boolean') return plain ? 'Yes' : 'No';
    return String(plain);
  }

  private defaultReply(language: SearchAssistLanguage): string {
    const copy: Record<SearchAssistLanguage, string> = {
      en: 'Here is what I understood — review the search criteria below.',
      fr: 'Voici ce que j’ai compris — vérifiez les critères de recherche ci-dessous.',
      rw: 'Ibi ndabonye — reba ibikurikizwa bya hasi.',
    };
    return copy[language];
  }

  private cap(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  }
}
