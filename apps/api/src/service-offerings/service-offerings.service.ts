import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { InteractionService } from '../personalization/interactions/interaction.service';
import { EmbeddingIndexService } from '../search/embedding/embedding-index.service';
import { ProviderContextService } from '../providers/provider-context.service';
import { STORAGE_SERVICE, StorageService } from '../files/storage.interface';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

const OFFERING_INCLUDE = {
  service: { include: { category: true } },
  attributeValues: { include: { categoryAttribute: true } },
  images: { orderBy: { position: 'asc' as const } },
} as const;

interface NormalizedValueEntry {
  attributeId: string;
  attributeName: string;
  displayValue: string;
  value: {
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    jsonValue: string[] | null;
  };
}

export type AttributeValueEntry = NormalizedValueEntry['value'];

// ServiceOfferingAttributeValue.jsonValue is a nullable `Json` column, and
// Prisma rejects a raw `null` for one of those — it wants Prisma.DbNull /
// Prisma.JsonNull instead. Every one of these columns is optional and
// already defaults to SQL NULL, so the simplest correct write is to omit
// `jsonValue` entirely when there's nothing to store, and hand the array
// over as a real JSON value when there is.
function attributeValueWrite(value: AttributeValueEntry) {
  const { jsonValue, ...rest } = value;
  if (jsonValue == null) return rest;
  return { ...rest, jsonValue: jsonValue as Prisma.InputJsonValue };
}

@Injectable()
export class ServiceOfferingsService {
  constructor(
    private prisma: PrismaService,
    private categories: CategoriesService,
    private interactions: InteractionService,
    private embeddingIndex: EmbeddingIndexService,
    private providerContext: ProviderContextService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  async create(userId: string, dto: CreateOfferingDto) {
    const provider = await this.getProvider(userId);

    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!service || !service.isActive) throw new BadRequestException('Service not found');

    const existing = await this.prisma.serviceOffering.findUnique({
      where: { providerId_serviceId: { providerId: provider.id, serviceId: dto.serviceId } },
    });
    if (existing) throw new BadRequestException('You already have an offering for this service');

    const normalizedValues = await this.validateAttributeValues(service.categoryId, dto.attributeValues ?? {});
    const images = await this.normalizeImages(dto.images);

    const created = await this.prisma.serviceOffering.create({
      data: {
        providerId: provider.id,
        serviceId: dto.serviceId,
        title: dto.title,
        description: dto.description,
        basePrice: dto.basePrice,
        priceType: dto.priceType,
        duration: dto.duration,
        availabilityNote: dto.availabilityNote,
        attributeValues: normalizedValues.length
          ? { create: normalizedValues.map((v) => ({ ...attributeValueWrite(v.value), categoryAttributeId: v.attributeId })) }
          : undefined,
        images: images.length ? { create: images } : undefined,
      },
      include: OFFERING_INCLUDE,
    });
    void this.embeddingIndex.enqueueReindex(created.id);
    return created;
  }

  async findMine(userId: string) {
    const provider = await this.getProvider(userId);
    return this.prisma.serviceOffering.findMany({
      where: { providerId: provider.id },
      include: OFFERING_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForOwner(userId: string, id: string) {
    const provider = await this.getProvider(userId);
    const offering = await this.prisma.serviceOffering.findUnique({ where: { id }, include: OFFERING_INCLUDE });
    if (!offering || offering.providerId !== provider.id) throw new NotFoundException('Service offering not found');
    return offering;
  }

  async findPublic(id: string, viewerUserId?: string) {
    const offering = await this.prisma.serviceOffering.findUnique({
      where: { id, isActive: true },
      include: {
        ...OFFERING_INCLUDE,
        provider: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            location: true,
            availabilityWindows: true,
            availabilityOverrides: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 14 },
          },
        },
      },
    });
    if (!offering) throw new NotFoundException('Service offering not found');
    if (viewerUserId) {
      await this.interactions.record(viewerUserId, 'VIEW_SERVICE', 'SERVICE_OFFERING', id);
    }
    return offering;
  }

  async listPublic(query: { providerId?: string; serviceId?: string; categoryId?: string; q?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const q = query.q?.trim();
    return this.prisma.serviceOffering.findMany({
      where: {
        isActive: true,
        ...(query.providerId ? { providerId: query.providerId } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.categoryId ? { service: { categoryId: query.categoryId } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { service: { name: { contains: q, mode: 'insensitive' } } },
                { provider: { businessName: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        ...OFFERING_INCLUDE,
        provider: {
          select: {
            id: true,
            businessName: true,
            logoUrl: true,
            verificationStatus: true,
            availabilityStatus: true,
            rating: true,
            reviewCount: true,
            location: { select: { city: true } },
            user: { select: { avatarUrl: true } },
          },
        },
      },
      orderBy: [{ provider: { rating: 'desc' } }, { updatedAt: 'desc' }],
      take: limit,
    });
  }

  async listPublicSitemapEntries() {
    return this.prisma.serviceOffering.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateOfferingDto) {
    const offering = await this.findOneForOwner(userId, id);

    if (dto.attributeValues) {
      const normalizedValues = await this.validateAttributeValues(
        offering.service.categoryId,
        dto.attributeValues,
        { partial: true },
      );
      await this.prisma.$transaction(
        normalizedValues.map((v) =>
          this.prisma.serviceOfferingAttributeValue.upsert({
            where: {
              serviceOfferingId_categoryAttributeId: {
                serviceOfferingId: id,
                categoryAttributeId: v.attributeId,
              },
            },
            create: { serviceOfferingId: id, categoryAttributeId: v.attributeId, ...attributeValueWrite(v.value) },
            update: attributeValueWrite(v.value),
          }),
        ),
      );
    }

    if (dto.images !== undefined) {
      const images = await this.normalizeImages(dto.images);
      await this.prisma.$transaction([
        this.prisma.serviceOfferingImage.deleteMany({ where: { serviceOfferingId: id } }),
        ...(images.length
          ? [this.prisma.serviceOfferingImage.createMany({ data: images.map((img) => ({ ...img, serviceOfferingId: id })) })]
          : []),
      ]);
    }

    const updated = await this.prisma.serviceOffering.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        basePrice: dto.basePrice,
        priceType: dto.priceType,
        duration: dto.duration,
        availabilityNote: dto.availabilityNote,
        isActive: dto.isActive,
      },
      include: OFFERING_INCLUDE,
    });
    if (dto.title !== undefined || dto.description !== undefined) {
      void this.embeddingIndex.enqueueReindex(updated.id);
    }
    return updated;
  }

  async remove(userId: string, id: string) {
    await this.findOneForOwner(userId, id);
    await this.prisma.serviceOffering.delete({ where: { id } });
    return { success: true };
  }

  // --- Shared validation (also used by ServiceRequestsService for the
  // request-time attribute snapshot, spec §20-21) ---

  async validateAttributeValues(
    categoryId: string,
    rawValues: Record<string, unknown>,
    options: { partial?: boolean } = {},
  ): Promise<NormalizedValueEntry[]> {
    const attributes = await this.categories.getAttributesForCategory(categoryId, { publicOnly: false });
    const byId = new Map(attributes.map((a) => [a.id, a]));

    // Security (spec §26): reject any key that isn't a real, active
    // attribute belonging to THIS category — never trust attribute IDs
    // from another category or a made-up name.
    for (const key of Object.keys(rawValues)) {
      if (!byId.has(key)) {
        throw new BadRequestException(`Unknown attribute for this category: ${key}`);
      }
    }

    if (!options.partial) {
      for (const attribute of attributes) {
        if (attribute.isRequired && !(attribute.id in rawValues)) {
          throw new BadRequestException(`"${attribute.name}" is required`);
        }
      }
    }

    return Object.entries(rawValues).map(([attributeId, rawValue]) => {
      const attribute = byId.get(attributeId)!;
      const value = this.categories.validateAttributeValue(attribute, rawValue);
      return {
        attributeId,
        attributeName: attribute.name,
        displayValue: this.formatDisplayValue(value),
        value,
      };
    });
  }

  private formatDisplayValue(value: NormalizedValueEntry['value']): string {
    if (value.booleanValue !== null) return value.booleanValue ? 'Yes' : 'No';
    if (value.jsonValue !== null) return value.jsonValue.join(', ');
    if (value.numberValue !== null) return String(value.numberValue);
    return value.textValue ?? '';
  }

  private async normalizeImages(images?: { storageKey: string; url?: string }[]) {
    if (!images?.length) return [];
    const seen = new Set<string>();
    const normalized: { storageKey: string; url: string; position: number }[] = [];
    for (const [index, image] of images.entries()) {
      const storageKey = image.storageKey?.trim();
      if (!storageKey || seen.has(storageKey)) continue;
      seen.add(storageKey);
      const stat = await this.storage.statObject(storageKey).catch(() => null);
      if (!stat) throw new BadRequestException('One or more offering images were not found. Upload them again.');
      normalized.push({ storageKey, url: image.url?.trim() || this.storage.getUrl(storageKey), position: index });
    }
    return normalized;
  }

  private async getProvider(userId: string) {
    return this.providerContext.resolveForUser(userId);
  }
}
