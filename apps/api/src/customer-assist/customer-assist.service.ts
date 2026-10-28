import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
import { redactPII } from '../common/utils/pii-redaction';
import { CustomerAssistDto } from './dto/customer-assist.dto';
import {
  CUSTOMER_ASSIST_LINK_KINDS,
  CUSTOMER_ASSIST_PROVIDER,
  CustomerAssistAction,
  CustomerAssistCatalogEntry,
  CustomerAssistLanguage,
  CustomerAssistLinkKind,
  CustomerAssistMessage,
  CustomerAssistOutput,
  CustomerAssistProvider,
  CustomerAssistProviderRow,
  CustomerAssistResult,
  DEFAULT_CUSTOMER_ASSIST_LANGUAGE,
  MAX_CUSTOMER_ASSIST_ACTIONS,
  MAX_CUSTOMER_ASSIST_CATEGORIES,
  MAX_CUSTOMER_ASSIST_PROVIDERS,
  MAX_CUSTOMER_ASSIST_QUESTIONS,
  MAX_CUSTOMER_ASSIST_SEARCH_QUERY,
  MAX_CUSTOMER_ASSIST_SERVICES,
  isCustomerAssistLanguage,
} from './customer-assist.interface';

const REPLY_MAX = 1200;

// The fixed page shortcuts the assistant may offer, with their real routes
// and a label per supported language. Kept server-side (never model output)
// so an action can only ever point at a route that exists.
const LINK_HREFS: Record<CustomerAssistLinkKind, string> = {
  'become-provider': '/become-a-provider',
  bookings: '/bookings',
  messages: '/messages',
  'saved-searches': '/saved-searches',
  disputes: '/disputes',
  account: '/account',
};

const LINK_LABELS: Record<CustomerAssistLinkKind, Record<CustomerAssistLanguage, string>> = {
  'become-provider': { en: 'Become a provider', rw: 'Ba umutanga serivisi', fr: 'Devenir prestataire' },
  bookings: { en: 'My bookings', rw: 'Ibyo nateganyije', fr: 'Mes réservations' },
  messages: { en: 'My messages', rw: 'Ubutumwa bwanjye', fr: 'Mes messages' },
  'saved-searches': { en: 'Saved searches', rw: 'Ibyo nashakishije', fr: 'Recherches enregistrées' },
  disputes: { en: 'Report a problem', rw: 'Tanga ikirego', fr: 'Signaler un problème' },
  account: { en: 'My account', rw: 'Konti yanjye', fr: 'Mon compte' },
};

const SEARCH_LABELS: Record<CustomerAssistLanguage, string> = {
  en: 'Search providers',
  rw: 'Shakisha abatanga serivisi',
  fr: 'Rechercher des prestataires',
};

@Injectable()
export class CustomerAssistService {
  constructor(
    private servicesService: ServicesService,
    private prisma: PrismaService,
    @Inject(CUSTOMER_ASSIST_PROVIDER) private provider: CustomerAssistProvider,
  ) {}

  async chat(dto: CustomerAssistDto): Promise<CustomerAssistResult> {
    if (!dto.message?.trim()) {
      throw new BadRequestException('Ask what you need help with');
    }
    if (dto.consentToProcess !== true) {
      throw new BadRequestException('Consent to AI processing is required');
    }

    // The catalog is loaded fresh from the database: the model may only
    // ever route to services that are really active right now, and it only
    // ever sees `${categorySlug}/${serviceSlug}` keys — never row ids.
    const services = await this.servicesService.findAll();
    const catalog: CustomerAssistCatalogEntry[] = services.map((s) => ({
      serviceId: s.id,
      key: `${s.category.slug}/${s.slug}`,
      name: s.name,
      category: s.category.name,
    }));
    const byKey = new Map(catalog.map((c) => [c.key, c] as const));

    const language = isCustomerAssistLanguage(dto.language)
      ? dto.language
      : DEFAULT_CUSTOMER_ASSIST_LANGUAGE;
    const history = (dto.history ?? []).map((m) => ({ role: m.role, text: redactPII(m.text.trim()) }));
    const messages: CustomerAssistMessage[] = [
      ...history.filter((m) => m.text),
      { role: 'user', text: redactPII(dto.message.trim()) },
    ];

    const output = await this.provider.suggest({
      language,
      messages,
      services: catalog.map(({ key, name, category }) => ({ key, name, category })),
    });

    return this.buildResult(output, { catalog, byKey, language });
  }

  // The provider's output is untrusted no matter which vendor produced it.
  // Every key is re-resolved against the live catalog before it reaches a
  // client; a forged/unknown key is dropped silently.
  private async buildResult(
    output: CustomerAssistOutput,
    ctx: { catalog: CustomerAssistCatalogEntry[]; byKey: Map<string, CustomerAssistCatalogEntry>; language: CustomerAssistLanguage },
  ): Promise<CustomerAssistResult> {
    const language = isCustomerAssistLanguage(output.language) ? output.language : ctx.language;

    const picked = new Map<string, CustomerAssistCatalogEntry>();
    for (const key of uniqueStrings(output.serviceKeys)) {
      if (picked.size >= MAX_CUSTOMER_ASSIST_SERVICES) break;
      const hit = ctx.byKey.get(key);
      if (hit) picked.set(hit.serviceId, hit);
    }

    // Broad-category fallback: e.g. the client says "upholstery" with no
    // single service — expand the category's slug to its services.
    if (picked.size === 0 && Array.isArray(output.categoryKeys)) {
      for (const catKey of uniqueStrings(output.categoryKeys).slice(0, MAX_CUSTOMER_ASSIST_CATEGORIES)) {
        if (picked.size >= MAX_CUSTOMER_ASSIST_SERVICES) break;
        for (const entry of ctx.catalog) {
          if (picked.size >= MAX_CUSTOMER_ASSIST_SERVICES) break;
          if (entry.key.startsWith(`${catKey}/`)) picked.set(entry.serviceId, entry);
        }
      }
    }

    const { services, providers } = await this.resolveSuggestions(
      [...picked.values()].slice(0, MAX_CUSTOMER_ASSIST_SERVICES),
    );

    return {
      reply: this.cap(typeof output.reply === 'string' && output.reply.trim() ? output.reply : this.defaultReply(language), REPLY_MAX),
      language,
      questions: this.validateQuestions(output.questions),
      suggestions: { services, providers },
      actions: this.buildActions(output, language),
    };
  }

  // Deep links the assistant may offer, built entirely server-side from a
  // validated kind plus a sanitized search sentence — the model never hands
  // us a URL, so it cannot point a client anywhere it should not.
  private buildActions(output: CustomerAssistOutput, language: CustomerAssistLanguage): CustomerAssistAction[] {
    const actions: CustomerAssistAction[] = [];

    const searchQuery =
      typeof output.searchQuery === 'string' ? this.sanitizeSearchQuery(output.searchQuery) : '';
    if (searchQuery) {
      const params = new URLSearchParams({ q: searchQuery, ai: '1' });
      actions.push({
        kind: 'search',
        label: SEARCH_LABELS[language],
        href: `/search?${params.toString()}`,
      });
    }

    if (Array.isArray(output.links)) {
      const seen = new Set<CustomerAssistLinkKind>();
      for (const raw of output.links) {
        if (actions.length >= MAX_CUSTOMER_ASSIST_ACTIONS) break;
        if (typeof raw !== 'string') continue;
        const kind = raw.trim() as CustomerAssistLinkKind;
        if (!(CUSTOMER_ASSIST_LINK_KINDS as readonly string[]).includes(kind)) continue;
        if (seen.has(kind)) continue;
        seen.add(kind);
        actions.push({ kind, label: LINK_LABELS[kind][language], href: LINK_HREFS[kind] });
      }
    }

    return actions.slice(0, MAX_CUSTOMER_ASSIST_ACTIONS);
  }

  // A search sentence becomes the search page's `q` (and is re-interpreted
  // into filters there). Strip control characters, collapse whitespace, and
  // cap the length so it can never smuggle markup or an oversized query.
  private sanitizeSearchQuery(value: string): string {
    const cleaned = value
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return '';
    return cleaned.length > MAX_CUSTOMER_ASSIST_SEARCH_QUERY
      ? cleaned.slice(0, MAX_CUSTOMER_ASSIST_SEARCH_QUERY).trim()
      : cleaned;
  }

  // Real providers, straight from the database: the assistant routes, it
  // never names — this is what stops it from hallucinating a provider.
  // Also counts distinct active providers per matched service so the
  // suggestion chip can say "N providers available".
  private async resolveSuggestions(
    entries: CustomerAssistCatalogEntry[],
  ): Promise<CustomerAssistResult['suggestions']> {
    if (entries.length === 0) return { services: [], providers: [] };

    const serviceIds = entries.map((e) => e.serviceId);
    const offerings = await this.prisma.serviceOffering.findMany({
      where: { serviceId: { in: serviceIds }, isActive: true },
      include: {
        provider: {
          include: {
            location: true,
            user: { select: { avatarUrl: true } },
          },
        },
      },
    });

    const counts = new Map<string, number>();
    for (const serviceId of serviceIds) {
      counts.set(serviceId, new Set(offerings.filter((o) => o.serviceId === serviceId).map((o) => o.providerId)).size);
    }

    const services = entries.map((e) => ({
      id: e.serviceId,
      key: e.key,
      name: e.name,
      category: e.category,
      providerCount: counts.get(e.serviceId) ?? 0,
    }));

    // One card per provider even when several matched services share the
    // same one; verified first, then by rating.
    const byProvider = new Map<string, CustomerAssistProviderRow>();
    for (const o of offerings) {
      const p = o.provider;
      if (byProvider.has(p.id)) continue;
      byProvider.set(p.id, {
        id: p.id,
        businessName: p.businessName,
        city: p.location?.city ?? null,
        rating: Number(p.rating),
        reviewCount: p.reviewCount,
        verified: p.verificationStatus === 'VERIFIED',
        avatarUrl: p.logoUrl ?? p.user.avatarUrl ?? null,
      });
      if (byProvider.size >= MAX_CUSTOMER_ASSIST_PROVIDERS) break;
    }
    const providers = [...byProvider.values()].sort(
      (a, b) => Number(b.verified) - Number(a.verified) || b.rating - a.rating,
    );

    return { services, providers };
  }

  private validateQuestions(questions: unknown): string[] {
    if (!Array.isArray(questions)) return [];
    return questions
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, MAX_CUSTOMER_ASSIST_QUESTIONS)
      .map((q) => this.cap(q, 300));
  }

  private defaultReply(language: CustomerAssistLanguage): string {
    if (language === 'rw') {
      return 'Sobanura icyo ukeneye — nanjye nzakuganisha ku bikorwa no ku batanga ibikorwa.';
    }
    if (language === 'fr') {
      return 'Décrivez ce dont vous avez besoin — je vous oriente vers les bonnes prestations et prestataires.';
    }
    return 'Tell me what you need and I\'ll point you to the right services and providers.';
  }

  private cap(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  }
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0))];
}