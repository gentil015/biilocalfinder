import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CategoryAttribute } from '@prisma/client';
import { ServicesService } from '../services/services.service';
import { CategoriesService } from '../categories/categories.service';
import { redactPII } from '../common/utils/pii-redaction';
import { BookingAssistDto } from './dto/booking-assist.dto';
import {
  BOOKING_ASSIST_PROVIDER,
  BookingAssistAttribute,
  BookingAssistLanguage,
  BookingAssistOutput,
  BookingAssistProvider,
  DEFAULT_BOOKING_ASSIST_LANGUAGE,
  MAX_BOOKING_ASSIST_QUESTIONS,
  isBookingAssistLanguage,
} from './booking-assist.interface';

// The form fields the assistant can fill — deliberately identical to what
// POST /service-requests accepts, so everything validated here flows into
// the existing request/booking pipeline untouched.
export interface BookingAssistFields {
  serviceId?: string;
  title?: string;
  description?: string;
  preferredDate?: string;
  preferredTime?: string;
  budgetMin?: number;
  budgetMax?: number;
  additionalNotes?: string;
  attributeValues?: Record<string, unknown>; // keyed by attribute id, ready for the form
}

export type BookingAssistMissingField = 'service' | 'title' | 'description';

export interface BookingAssistResult {
  reply: string;
  language: BookingAssistLanguage;
  fields: BookingAssistFields;
  // Required-to-submit fields still empty after this turn — the client is
  // shown these until the form is complete (nothing is ever auto-submitted).
  missingFields: BookingAssistMissingField[];
  // Follow-up questions in the client's language: whatever the model asked
  // plus deterministic ones for any missing required field.
  questions: string[];
  suggestedCount: number;
  skippedCount: number;
}

const TITLE_MAX = 90;
const DESCRIPTION_MAX = 2000;
const NOTES_MAX = 2000;
const QUESTION_MAX = 300;
const BUDGET_MAX = 10_000_000_000; // Decimal(12,2) ceiling — anything beyond is nonsense input
const REQUIRED_FIELDS: BookingAssistMissingField[] = ['service', 'title', 'description'];
const COUNTABLE_FIELDS = [
  'title',
  'description',
  'preferredDate',
  'preferredTime',
  'budgetMin',
  'budgetMax',
  'additionalNotes',
] as const;

@Injectable()
export class BookingAssistService {
  constructor(
    private servicesService: ServicesService,
    private categoriesService: CategoriesService,
    @Inject(BOOKING_ASSIST_PROVIDER) private provider: BookingAssistProvider,
  ) {}

  async suggest(dto: BookingAssistDto): Promise<BookingAssistResult> {
    if (!dto.message?.trim()) {
      throw new BadRequestException('Describe what you need to get started');
    }
    if (dto.consentToProcess !== true) {
      throw new BadRequestException('Consent to AI processing is required');
    }

    // The catalog is loaded fresh from the database: the model may only
    // ever suggest services that are really active right now, and it only
    // ever sees `${categorySlug}/${serviceSlug}` keys — never row ids.
    const services = await this.servicesService.findAll();
    const catalog = services.map((s) => ({
      serviceId: s.id,
      key: `${s.category.slug}/${s.slug}`,
      name: s.name,
      category: s.category.name,
    }));
    const byKey = new Map<string, { serviceId: string }>(catalog.map((c) => [c.key, { serviceId: c.serviceId }] as const));

    // A service already selected in the form pins the conversation: the
    // model may not swap it, and its category's questions become askable.
    const locked = dto.serviceId ? catalog.find((c) => c.serviceId === dto.serviceId) : undefined;
    let attributeSchema: BookingAssistAttribute[] = [];
    let attributeRows: CategoryAttribute[] = [];
    if (locked) {
      const service = services.find((s) => s.id === locked.serviceId);
      if (service) {
        attributeRows = await this.categoriesService.getAttributesForCategory(service.categoryId, {
          publicOnly: true,
        });
        attributeSchema = attributeRows.map((a) => ({
          slug: a.slug,
          name: a.name,
          description: a.description,
          type: a.type as BookingAssistAttribute['type'],
          isRequired: a.isRequired,
          options: (a.options as string[] | null) ?? undefined,
        }));
      }
    }

    const language = isBookingAssistLanguage(dto.language) ? dto.language : DEFAULT_BOOKING_ASSIST_LANGUAGE;
    const history = (dto.history ?? []).map((m) => ({ role: m.role, text: redactPII(m.text.trim()) }));
    const messages = [
      ...history.filter((m) => m.text),
      { role: 'user' as const, text: redactPII(dto.message.trim()) },
    ];

    const output = await this.provider.suggest({
      language,
      messages,
      services: catalog.map(({ key, name, category }) => ({ key, name, category })),
      serviceLocked: locked ? { key: locked.key, name: locked.name, category: locked.category } : undefined,
      attributes: attributeSchema,
    });

    return this.validate(output, {
      byKey,
      serviceId: locked?.serviceId,
      language,
      filled: dto.filledFields ?? [],
      attributeRows,
    });
  }

  // The provider's output is untrusted no matter which vendor produced it.
  // Every field is checked against real data and the same rules a manual
  // submission would hit; anything invalid is dropped (counted in
  // skippedCount) instead of surfacing an error — a bad AI turn should
  // never block the client from filling the form themselves.
  private validate(
    output: BookingAssistOutput,
    ctx: {
      byKey: Map<string, { serviceId: string }>;
      serviceId?: string;
      language: BookingAssistLanguage;
      filled: string[];
      attributeRows: CategoryAttribute[];
    },
  ): BookingAssistResult {
    const fields: BookingAssistFields = {};
    let skipped = 0;

    // When the service is already pinned by the form, a model-suggested
    // key is ignored outright — the conversation cannot silently switch
    // services. An unknown/forged key never resolves to anything.
    if (!ctx.serviceId && typeof output.serviceKey === 'string') {
      const hit = ctx.byKey.get(output.serviceKey);
      if (hit) fields.serviceId = hit.serviceId;
      else skipped += 1;
    }

    if (typeof output.title === 'string' && output.title.trim()) {
      fields.title = this.cap(output.title, TITLE_MAX);
    }
    if (typeof output.description === 'string' && output.description.trim()) {
      fields.description = this.cap(output.description, DESCRIPTION_MAX);
    }

    if (output.preferredDate !== undefined) {
      const date = typeof output.preferredDate === 'string' ? this.validateDate(output.preferredDate) : undefined;
      if (date) fields.preferredDate = date;
      else skipped += 1;
    }
    if (output.preferredTime !== undefined) {
      const time = typeof output.preferredTime === 'string' ? this.validateTime(output.preferredTime) : undefined;
      if (time) fields.preferredTime = time;
      else skipped += 1;
    }

    const budgetMin = this.validateBudget(output.budgetMin);
    const budgetMax = this.validateBudget(output.budgetMax);
    if (output.budgetMin !== undefined && budgetMin === undefined) skipped += 1;
    if (output.budgetMax !== undefined && budgetMax === undefined) skipped += 1;
    if (budgetMin !== undefined && budgetMax !== undefined && budgetMin > budgetMax) {
      skipped += 2; // an inverted range is unusable — drop the pair, never guess which end is wrong
    } else {
      if (budgetMin !== undefined) fields.budgetMin = budgetMin;
      if (budgetMax !== undefined) fields.budgetMax = budgetMax;
    }

    if (typeof output.additionalNotes === 'string' && output.additionalNotes.trim()) {
      fields.additionalNotes = this.cap(output.additionalNotes, NOTES_MAX);
    }

    // Category answers only exist once a service is known: resolve slug ->
    // id and re-run every value through the exact same
    // validateAttributeValue() a manual form submission hits. Unknown
    // slugs and failing values are silently dropped.
    const values = output.values && typeof output.values === 'object' ? Object.entries(output.values) : [];
    if (values.length) {
      if (ctx.attributeRows.length) {
        const bySlug = new Map(ctx.attributeRows.map((a) => [a.slug, a] as const));
        const attributeValues: Record<string, unknown> = {};
        for (const [slug, rawValue] of values) {
          const attribute = bySlug.get(slug);
          if (!attribute) {
            skipped += 1;
            continue;
          }
          try {
            const normalized = this.categoriesService.validateAttributeValue(attribute, rawValue);
            const plain = this.denormalize(attribute.type, normalized);
            if (plain !== undefined) attributeValues[attribute.id] = plain;
            else skipped += 1;
          } catch {
            skipped += 1;
          }
        }
        if (Object.keys(attributeValues).length) fields.attributeValues = attributeValues;
      } else {
        skipped += values.length; // attributes without a service can't belong to any category
      }
    }

    // Still missing: required-to-submit fields the model did not fill this
    // turn and the client says are already done in the form. A pinned
    // service (ctx.serviceId) counts as done — it came from the form.
    const filled = new Set(ctx.filled);
    const missingFields = REQUIRED_FIELDS.filter(
      (f) => !(f === 'service' && ctx.serviceId) && !filled.has(f) && !isFilled(f, fields),
    );

    const language = isBookingAssistLanguage(output.language) ? output.language : ctx.language;
    const questions = [...this.validateQuestions(output.questions)];
    for (const field of missingFields) questions.push(this.cannedQuestion(language, field));
    const finalQuestions = questions.slice(0, MAX_BOOKING_ASSIST_QUESTIONS);

    const suggestedCount =
      (fields.serviceId ? 1 : 0) +
      COUNTABLE_FIELDS.filter((k) => fields[k] !== undefined).length +
      Object.keys(fields.attributeValues ?? {}).length;

    const reply =
      typeof output.reply === 'string' && output.reply.trim()
        ? this.cap(output.reply, 2000)
        : this.defaultReply(language, missingFields.length > 0);

    return { reply, language, fields, missingFields, questions: finalQuestions, suggestedCount, skippedCount: skipped };
  }

  // Accepts a real calendar day, not before today, round-tripping through
  // Date so "2026-02-31" cannot slip through.
  private validateDate(value: string): string | undefined {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return undefined;
    return value >= new Date().toISOString().slice(0, 10) ? value : undefined;
  }

  private validateTime(value: string): string | undefined {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
  }

  private validateBudget(value: unknown): number | undefined {
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > BUDGET_MAX) return undefined;
    return Math.round(n * 100) / 100;
  }

  private validateQuestions(questions: unknown): string[] {
    if (!Array.isArray(questions)) return [];
    return questions
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 4)
      .map((q) => this.cap(q, QUESTION_MAX));
  }

  // Deterministic follow-ups for required fields — guarantees the "ask
  // when info is missing" contract even if the model returned nothing.
  private cannedQuestion(language: BookingAssistLanguage, field: BookingAssistMissingField): string {
    const copy: Record<BookingAssistLanguage, Record<BookingAssistMissingField, string>> = {
      en: {
        service: 'Which service do you need? Pick the closest match or describe it differently.',
        title: 'What should we call this request? A short title helps providers respond quickly.',
        description: 'Please describe the job in a sentence or two so providers know what to expect.',
      },
      fr: {
        service: 'De quel service avez-vous besoin ? Choisissez la correspondance la plus proche ou décrivez-le autrement.',
        title: 'Comment appeler cette demande ? Un titre court aide les prestataires à répondre vite.',
        description: 'Décrivez le travail en une ou deux phrases pour que les prestataires sachent à quoi s’attendre.',
      },
      rw: {
        service: 'Ni servisi iki ukeneye? Hitamo iyakwegereya cyangwa wongere usobanure.',
        title: 'Tanga insanganyamatsiko y’iki cyatanzwe kugira abatanga ibikorwa basobanure vuba.',
        description: 'Sobanura ikintu ukeneye mu magambo make kugira abatanga ibikorwa bamenye icyo bagomba gukora.',
      },
    };
    return copy[language][field];
  }

  private defaultReply(language: BookingAssistLanguage, needsMore: boolean): string {
    if (language === 'rw') {
      return needsMore
        ? 'Nkeneye ibindi bigirwa — reba ibibazo hasi.'
        : 'Byose biratanzwe. Reba ibicubyo hasi kandi ohereza icyatanzwe niba wemera.';
    }
    if (language === 'fr') {
      return needsMore
        ? 'J’ai encore besoin de quelques précisions — voir mes questions ci-dessous.'
        : 'Tout est prêt — vérifiez les champs ci-dessous et envoyez la demande quand vous êtes satisfait.';
    }
    return needsMore
      ? 'I need a little more information — see my questions below.'
      : "That's everything I need — review the fields below and send the request when you're happy.";
  }

  private cap(value: string, max: number): string {
    const trimmed = value.trim();
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  }

  // validateAttributeValue() returns the normalized DB-column shape;
  // convert back to the plain value the frontend's attribute inputs expect.
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
}

function isFilled(field: BookingAssistMissingField, fields: BookingAssistFields): boolean {
  if (field === 'service') return !!fields.serviceId;
  const value = fields[field];
  return typeof value === 'string' && value.trim().length > 0;
}
