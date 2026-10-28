import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ServicesService } from '../services/services.service';
import { CategoriesService } from '../categories/categories.service';
import { redactPII } from '../common/utils/pii-redaction';
import { STORAGE_SERVICE, StorageService, ALLOWED_IMAGE_MIME_TYPES } from '../files/storage.interface';
import { SuggestRequestDto } from './dto/suggest-request.dto';
import {
  AssistAttributeSchema,
  MAX_ASSIST_IMAGE_BYTES,
  REQUEST_ASSIST_PROVIDER,
  RequestAssistProvider,
} from './assist-provider.interface';

export interface RequestAssistResult {
  title?: string;
  description?: string;
  attributeValues: Record<string, unknown>; // keyed by attribute id — ready to feed straight into the request form
  suggestedCount: number;
  skippedCount: number; // suggestions the model made that failed validation and were dropped
}

@Injectable()
export class RequestAssistService {
  private readonly logger = new Logger(RequestAssistService.name);

  constructor(
    private servicesService: ServicesService,
    private categoriesService: CategoriesService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
    @Inject(REQUEST_ASSIST_PROVIDER) private provider: RequestAssistProvider,
  ) {}

  async suggest(dto: SuggestRequestDto): Promise<RequestAssistResult> {
    if (!dto.description?.trim() && !dto.imageKey) {
      throw new BadRequestException('Provide a description or a photo to get suggestions');
    }
    if (dto.consentToProcess !== true) {
      throw new BadRequestException('Consent to AI processing is required');
    }

    const service = await this.servicesService.findOne(dto.serviceId);
    // Only the fields the client would actually be shown on the form
    // (spec pattern for §20: never surface/ask about a field the request
    // form itself wouldn't show).
    const attributes = await this.categoriesService.getAttributesForCategory(service.categoryId, {
      publicOnly: true,
    });

    const schema: AssistAttributeSchema[] = attributes.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      type: a.type as AssistAttributeSchema['type'],
      isRequired: a.isRequired,
      options: (a.options as string[] | null) ?? undefined,
    }));

    const image = dto.imageKey ? await this.loadImage(dto.imageKey) : null;

    const suggestion = await this.provider.suggest({
      categoryName: service.category.name,
      serviceName: service.name,
      attributes: schema,
      clientText: dto.description ? redactPII(dto.description) : dto.description,
      imageBase64: image?.base64,
      imageMimeType: image?.mimeType,
    });

    // The provider's output is untrusted no matter which vendor produced
    // it — resolve slug -> id and run every value back through the exact
    // same validateAttributeValue() a manual form submission would hit.
    // Anything that fails (wrong type, option not in the list, unknown
    // slug) is silently dropped rather than surfaced as an error: a bad
    // suggestion should never block the client from filling the form
    // themselves.
    const bySlug = new Map(attributes.map((a) => [a.slug, a] as const));
    const attributeValues: Record<string, unknown> = {};
    let skipped = 0;

    for (const [slug, rawValue] of Object.entries(suggestion.values ?? {})) {
      const attribute = bySlug.get(slug);
      if (!attribute) {
        skipped += 1;
        continue;
      }
      try {
        const normalized = this.categoriesService.validateAttributeValue(attribute, rawValue);
        attributeValues[attribute.id] = this.denormalize(attribute.type, normalized);
      } catch {
        skipped += 1;
      }
    }

    return {
      title: this.capTitle(suggestion.title),
      description: typeof suggestion.description === 'string' ? suggestion.description.slice(0, 2000) : undefined,
      attributeValues,
      suggestedCount: Object.keys(attributeValues).length,
      skippedCount: skipped,
    };
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

  private capTitle(title?: string): string | undefined {
    if (typeof title !== 'string') return undefined;
    const trimmed = title.trim();
    return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed || undefined;
  }

  // Reads back an already-uploaded, already-validated file by key — this
  // never accepts image bytes directly from the request, only a key the
  // /files/upload endpoint issued after its own MIME/size checks.
  private async loadImage(key: string): Promise<{ base64: string; mimeType: string } | null> {
    const stat = await this.storage.statObject(key);
    if (!stat) throw new BadRequestException('Uploaded image not found');
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(stat.mimeType)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are supported');
    }
    if (stat.sizeBytes > MAX_ASSIST_IMAGE_BYTES) {
      throw new BadRequestException('Image is too large for AI assist (max 5MB)');
    }

    try {
      const res = await fetch(this.storage.getUrl(key));
      if (!res.ok) throw new Error(`status ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      return { base64: buffer.toString('base64'), mimeType: stat.mimeType };
    } catch (err) {
      this.logger.warn(`Could not fetch uploaded image for assist: ${(err as Error).message}`);
      return null;
    }
  }
}
