import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
import { redactPII } from '../common/utils/pii-redaction';
import { CustomerAssistDto } from './dto/customer-assist.dto';
import {
  CUSTOMER_ASSIST_ACCEPTING_REQUEST_STATUSES,
  CUSTOMER_ASSIST_LINK_KINDS,
  CUSTOMER_ASSIST_PROVIDER,
  CUSTOMER_ASSIST_RICH_ACTION_KINDS,
  CustomerAssistAction,
  CustomerAssistActionIntent,
  CustomerAssistCatalogEntry,
  CustomerAssistClientContext,
  CustomerAssistContext,
  CustomerAssistLanguage,
  CustomerAssistLinkKind,
  CustomerAssistMessage,
  CustomerAssistOutput,
  CustomerAssistProvider,
  CustomerAssistProviderContext,
  CustomerAssistProviderRow,
  CustomerAssistResult,
  CustomerAssistRichActionKind,
  CustomerAssistRole,
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

const RICH_ACTION_LABELS: Record<CustomerAssistRichActionKind, Record<CustomerAssistLanguage, string>> = {
  'prefill-request': { en: 'Post this request', rw: 'Tanga ubusabe', fr: 'Publier cette demande' },
  'open-booking': { en: 'Open booking', rw: 'Fungura iteganyagihe', fr: 'Ouvrir la réservation' },
  'open-request': { en: 'Open request', rw: 'Fungura ubusabe', fr: 'Ouvrir la demande' },
  'open-offering': { en: 'Manage offering', rw: 'Genzura serivisi', fr: 'Gérer la prestation' },
  'send-quote': { en: 'Send this quote', rw: 'Ohereza igiciro', fr: 'Envoyer ce devis' },
  'toggle-availability': { en: 'Update availability', rw: 'Hindura uko uhari', fr: 'Mettre à jour la disponibilité' },
};

const MAX_ACTION_PRICE = 1_000_000_000;

interface ClientRefs {
  requests: Map<string, string>;
  bookings: Map<string, string>;
}

interface ProviderIncomingRef {
  id: string;
  title: string;
  canQuote: boolean;
}

interface ProviderRefs {
  providerId: string;
  incomingRequests: Map<string, ProviderIncomingRef>;
  bookings: Map<string, string>;
  offerings: Map<string, string>;
}

interface LoadedContext {
  context?: CustomerAssistContext;
  clientRefs?: ClientRefs;
  providerRefs?: ProviderRefs;
}

interface ResolvedIdentity extends LoadedContext {
  role: CustomerAssistRole;
}

interface ActionResultContext {
  role: CustomerAssistRole;
  language: CustomerAssistLanguage;
  catalog: CustomerAssistCatalogEntry[];
  byKey: Map<string, CustomerAssistCatalogEntry>;
  clientRefs?: ClientRefs;
  providerRefs?: ProviderRefs;
}

@Injectable()
export class CustomerAssistService {
  constructor(
    private servicesService: ServicesService,
    private prisma: PrismaService,
    @Inject(CUSTOMER_ASSIST_PROVIDER) private provider: CustomerAssistProvider,
  ) {}

  async chat(
    dto: CustomerAssistDto,
    user?: { id: string; role: string },
    workspaceId?: string,
  ): Promise<CustomerAssistResult> {
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

    const identity = await this.resolveIdentity(user, workspaceId);

    const output = await this.provider.suggest({
      language,
      role: identity.role,
      messages,
      services: catalog.map(({ key, name, category }) => ({ key, name, category })),
      context: identity.context,
    });

    return this.buildResult(output, {
      catalog,
      byKey,
      language,
      role: identity.role,
      clientRefs: identity.clientRefs,
      providerRefs: identity.providerRefs,
    });
  }

  // Who is asking, and what may they see? A guest gets the public catalog
  // only. A signed-in user gets a snapshot of their own rows — never
  // anyone else's. Admin accounts get the platform guide without personal
  // marketplace data.
  private async resolveIdentity(
    user?: { id: string; role: string },
    workspaceId?: string,
  ): Promise<ResolvedIdentity> {
    if (!user) return { role: 'GUEST' };
    if (user.role === 'ADMIN') return { role: 'ADMIN' };

    const provider = await this.loadProviderContext(user.id, workspaceId);
    if (provider) return { role: 'PROVIDER', ...provider };
    if (user.role === 'PROVIDER') return { role: 'PROVIDER' };

    const client = await this.loadClientContext(user.id);
    if (client) return { role: 'CLIENT', ...client };
    return { role: 'CLIENT' };
  }

  private async loadClientContext(userId: string): Promise<LoadedContext | undefined> {
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId } });
    if (!profile) return undefined;

    const [requests, bookings, quotes] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where: { clientId: profile.id },
        include: { service: true, _count: { select: { quotes: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.booking.findMany({
        where: { clientId: profile.id },
        include: { provider: true, serviceRequest: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.quote.findMany({
        where: { request: { clientId: profile.id } },
        include: { provider: true, request: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const requestRefs = new Map<string, string>();
    const bookingRefs = new Map<string, string>();

    const context: CustomerAssistClientContext = {
      requests: requests.map((r, i) => {
        const ref = `cr${i + 1}`;
        requestRefs.set(ref, r.id);
        return {
          ref,
          title: r.title,
          status: r.status,
          service: r.service.name,
          quoteCount: r._count.quotes,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      bookings: bookings.map((b, i) => {
        const ref = `cb${i + 1}`;
        bookingRefs.set(ref, b.id);
        return {
          ref,
          service: b.serviceRequest.service.name,
          provider: b.provider.businessName,
          status: b.status,
          scheduledAt: b.scheduledAt?.toISOString() ?? null,
        };
      }),
      quotes: quotes.map((q, i) => ({
        ref: `cq${i + 1}`,
        request: q.request.title,
        provider: q.provider.businessName,
        price: Number(q.price),
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
    };

    return { context: { client: context }, clientRefs: { requests: requestRefs, bookings: bookingRefs } };
  }

  private async loadProviderContext(
    userId: string,
    workspaceId?: string,
  ): Promise<LoadedContext | undefined> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { workspace: { include: { provider: { include: { location: true } } } } },
    });
    const candidates = memberships.flatMap((membership) =>
      membership.workspace.provider
        ? [{ membership, provider: membership.workspace.provider }]
        : [],
    );

    if (candidates.length === 0) return undefined;
    const selected = workspaceId
      ? candidates.find((c) => c.membership.workspaceId === workspaceId)
      : candidates.length === 1
        ? candidates[0]
        : undefined;
    if (!selected) return undefined;

    const provider = selected.provider;
    const memberScope = selected.membership.role === 'MEMBER'
      ? { assignedMembershipId: selected.membership.id }
      : {};
    const accepting = [...CUSTOMER_ASSIST_ACCEPTING_REQUEST_STATUSES];

    const offerings = await this.prisma.serviceOffering.findMany({
      where: { providerId: provider.id },
      include: { service: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const serviceIds = offerings.map((o) => o.serviceId);

    const [incomingRequests, bookings, quotes, weekly, exceptions] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where: {
          ...memberScope,
          OR: [
            { providerId: provider.id, status: { in: accepting } },
            { providerId: provider.id, quotes: { some: { providerId: provider.id } } },
            { providerId: null, serviceId: { in: serviceIds }, status: 'OPEN' },
            {
              providerId: { not: provider.id },
              isPublic: true,
              serviceId: { in: serviceIds },
              status: { in: accepting },
            },
          ],
        },
        include: { service: true, _count: { select: { quotes: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.booking.findMany({
        where: { providerId: provider.id, ...memberScope },
        include: { serviceRequest: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.quote.findMany({
        where: { providerId: provider.id },
        include: { request: { include: { service: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.availability.findMany({ where: { providerId: provider.id }, orderBy: { dayOfWeek: 'asc' } }),
      this.prisma.availabilityException.findMany({
        where: { providerId: provider.id, date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        orderBy: { date: 'asc' },
        take: 14,
      }),
    ]);

    const incomingRefs = new Map<string, ProviderIncomingRef>();
    const bookingRefs = new Map<string, string>();
    const offeringRefs = new Map<string, string>();

    const context: CustomerAssistProviderContext = {
      businessName: provider.businessName,
      verificationStatus: provider.verificationStatus,
      availabilityStatus: provider.availabilityStatus,
      rating: Number(provider.rating),
      reviewCount: provider.reviewCount,
      city: provider.location?.city ?? null,
      hasDescription: !!provider.description?.trim(),
      hasLogo: !!provider.logoUrl,
      onboardingComplete: !!provider.onboardingCompletedAt,
      multipleWorkspaces: candidates.length > 1,
      offerings: offerings.map((o, i) => {
        const ref = `o${i + 1}`;
        offeringRefs.set(ref, o.id);
        return {
          ref,
          service: o.service.name,
          title: o.title ?? o.service.name,
          price: o.basePrice === null ? null : Number(o.basePrice),
          isActive: o.isActive,
        };
      }),
      incomingRequests: incomingRequests.map((r, i) => {
        const ref = `pr${i + 1}`;
        const canQuote = accepting.includes(r.status as (typeof accepting)[number]) && this.canQuoteRequest(r, provider.id, serviceIds);
        incomingRefs.set(ref, { id: r.id, title: r.title, canQuote });
        return {
          ref,
          title: r.title,
          service: r.service.name,
          status: r.status,
          budgetMin: r.budgetMin === null ? null : Number(r.budgetMin),
          budgetMax: r.budgetMax === null ? null : Number(r.budgetMax),
          preferredDate: r.preferredDate?.toISOString().slice(0, 10) ?? null,
          quoteCount: r._count.quotes,
          canQuote,
        };
      }),
      bookings: bookings.map((b, i) => {
        const ref = `pb${i + 1}`;
        bookingRefs.set(ref, b.id);
        return {
          ref,
          requestId: b.serviceRequestId,
          service: b.serviceRequest.service.name,
          status: b.status,
          scheduledAt: b.scheduledAt?.toISOString() ?? null,
        };
      }),
      quotes: quotes.map((q, i) => ({
        ref: `pq${i + 1}`,
        request: q.request.title,
        price: Number(q.price),
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
      availability: {
        status: provider.availabilityStatus,
        days: weekly.map((w) => ({ dayOfWeek: w.dayOfWeek, startTime: w.startTime, endTime: w.endTime })),
        exceptions: exceptions.map((e) => ({ date: e.date.toISOString().slice(0, 10), isAvailable: e.isAvailable })),
      },
    };

    return {
      context: { provider: context },
      providerRefs: {
        providerId: provider.id,
        incomingRequests: incomingRefs,
        bookings: bookingRefs,
        offerings: offeringRefs,
      },
    };
  }

  // A request is quotable when it is still accepting quotes and this
  // provider is allowed to quote it: its own direct request, a broadcast
  // request for a service it offers, or a client-opened request for a
  // service it offers.
  private canQuoteRequest(
    request: { providerId: string | null; isPublic: boolean; serviceId: string },
    providerId: string,
    serviceIds: string[],
  ): boolean {
    if (request.providerId === providerId) return true;
    if (!serviceIds.includes(request.serviceId)) return false;
    return request.providerId === null || request.isPublic;
  }

  // The provider's output is untrusted no matter which vendor produced it.
  // Every key is re-resolved against the live catalog before it reaches a
  // client; a forged/unknown key is dropped silently.
  private async buildResult(
    output: CustomerAssistOutput,
    ctx: ActionResultContext,
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
      role: ctx.role,
      questions: this.validateQuestions(output.questions),
      suggestions: { services, providers },
      actions: this.buildActions(output, ctx),
    };
  }

  // Deep links the assistant may offer, built entirely server-side from a
  // validated kind plus a sanitized search sentence — the model never hands
  // us a URL, so it cannot point a client anywhere it should not.
  private buildActions(output: CustomerAssistOutput, ctx: ActionResultContext): CustomerAssistAction[] {
    const { language } = ctx;
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

    // Rich actions are the whole point of the assistant's task layer, so
    // they get priority over generic page shortcuts.
    for (const action of this.buildRichActions(output.actions, ctx)) {
      if (actions.length >= MAX_CUSTOMER_ASSIST_ACTIONS) break;
      actions.push(action);
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

  // Re-validates every model-proposed action against the caller's own live
  // context. This is the security boundary: the model cannot invent a
  // record, act on someone else's row, bypass a status check, or smuggle a
  // URL. Invalid intents are dropped silently, exactly like unknown
  // service keys.
  private buildRichActions(intents: unknown, ctx: ActionResultContext): CustomerAssistAction[] {
    if (!Array.isArray(intents)) return [];
    const actions: CustomerAssistAction[] = [];

    for (const raw of intents) {
      if (actions.length >= MAX_CUSTOMER_ASSIST_ACTIONS) break;
      if (!raw || typeof raw !== 'object') continue;
      const intent = raw as CustomerAssistActionIntent;
      const kind = typeof intent.kind === 'string' ? intent.kind.trim() : '';
      if (!(CUSTOMER_ASSIST_RICH_ACTION_KINDS as readonly string[]).includes(kind)) continue;

      const action = this.buildRichAction(kind as CustomerAssistRichActionKind, intent, ctx);
      if (action) actions.push(action);
    }

    return actions;
  }

  private buildRichAction(
    kind: CustomerAssistRichActionKind,
    intent: CustomerAssistActionIntent,
    ctx: ActionResultContext,
  ): CustomerAssistAction | null {
    const label = RICH_ACTION_LABELS[kind][ctx.language];

    if (kind === 'prefill-request') {
      if (ctx.role !== 'CLIENT') return null;
      const serviceKey = typeof intent.serviceKey === 'string' ? intent.serviceKey.trim() : '';
      const service = ctx.byKey.get(serviceKey);
      if (!service) return null;

      const params = new URLSearchParams({ serviceId: service.serviceId });
      const title = this.sanitizeText(intent.title, 200) || service.name;
      const description = this.sanitizeText(intent.description, 4000);
      const preferredDate = this.sanitizeDate(intent.preferredDate);
      const preferredTime = this.sanitizeTime(intent.preferredTime);
      const budgetMin = this.sanitizeAmount(intent.budgetMin);
      const budgetMax = this.sanitizeAmount(intent.budgetMax);
      const additionalNotes = this.sanitizeText(intent.additionalNotes, 1000);

      params.set('title', title);
      if (description) params.set('description', description);
      if (preferredDate) params.set('preferredDate', preferredDate);
      if (preferredTime) params.set('preferredTime', preferredTime);
      if (budgetMin !== null) params.set('budgetMin', String(budgetMin));
      if (budgetMax !== null) params.set('budgetMax', String(budgetMax));
      if (additionalNotes) params.set('additionalNotes', additionalNotes);

      return {
        kind,
        label,
        href: `/requests/new?${params.toString()}`,
        summary: title,
      };
    }

    if (kind === 'open-request') {
      if (ctx.role !== 'CLIENT' || !ctx.clientRefs) return null;
      const id = ctx.clientRefs.requests.get(this.sanitizeText(intent.requestRef, 10));
      if (!id) return null;
      return { kind, label, href: `/requests/${id}` };
    }

    if (kind === 'open-booking') {
      const ref = this.sanitizeText(intent.bookingRef, 10);
      const id = ctx.role === 'PROVIDER'
        ? ctx.providerRefs?.bookings.get(ref)
        : ctx.clientRefs?.bookings.get(ref);
      if (!id) return null;
      return { kind, label, href: `/bookings/${id}` };
    }

    if (kind === 'open-offering') {
      if (ctx.role !== 'PROVIDER' || !ctx.providerRefs) return null;
      const id = ctx.providerRefs.offerings.get(this.sanitizeText(intent.offeringRef, 10));
      if (!id) return null;
      return { kind, label, href: '/provider/offerings', payload: { offeringId: id } };
    }

    if (kind === 'send-quote') {
      if (ctx.role !== 'PROVIDER' || !ctx.providerRefs) return null;
      const incoming = ctx.providerRefs.incomingRequests.get(this.sanitizeText(intent.requestRef, 10));
      if (!incoming || !incoming.canQuote) return null;
      const price = this.sanitizeAmount(intent.price);
      if (price === null) return null;
      const estimatedDuration = this.sanitizeText(intent.estimatedDuration, 100);
      const description = this.sanitizeText(intent.description, 2000);

      return {
        kind,
        label,
        summary: `${incoming.title} · ${price.toLocaleString('en-US')} RWF`,
        payload: {
          requestId: incoming.id,
          price,
          ...(estimatedDuration ? { estimatedDuration } : {}),
          ...(description ? { description } : {}),
        },
        requiresConfirmation: true,
      };
    }

    // toggle-availability
    if (ctx.role !== 'PROVIDER' || !ctx.providerRefs) return null;
    const status = typeof intent.status === 'string' ? intent.status.trim().toUpperCase() : '';
    if (status !== 'AVAILABLE' && status !== 'UNAVAILABLE') return null;
    return {
      kind,
      label,
      summary: status === 'AVAILABLE' ? 'AVAILABLE' : 'UNAVAILABLE',
      payload: { status },
      requiresConfirmation: true,
    };
  }

  private sanitizeText(value: unknown, max: number): string {
    if (typeof value !== 'string') return '';
    const cleaned = value
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
  }

  private sanitizeDate(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return '';
    const cleaned = value.trim();
    const parsed = new Date(`${cleaned}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== cleaned) return '';
    return cleaned >= new Date().toISOString().slice(0, 10) ? cleaned : '';
  }

  private sanitizeTime(value: unknown): string {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim())) return '';
    return value.trim();
  }

  private sanitizeAmount(value: unknown): number | null {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > MAX_ACTION_PRICE) return null;
    return Math.round(n * 100) / 100;
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