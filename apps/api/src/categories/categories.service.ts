import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttributeType, CategoryAttribute } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { ReorderAttributesDto } from './dto/reorder-attributes.dto';

const OPTION_TYPES: AttributeType[] = ['SELECT', 'MULTI_SELECT'];

// The typed, normalized shape a validated attribute value is stored as —
// only the column matching the attribute's type is ever populated (spec
// §14, §25). Never derived from raw client input without going through
// validateAttributeValue() first.
export interface NormalizedAttributeValue {
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  jsonValue: string[] | null;
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // Public: full tree, used by search filters and the home page.
  async findTree() {
    const all = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    type CategoryNode = (typeof all)[number] & { children: CategoryNode[] };
    const byId = new Map<string, CategoryNode>(all.map((c: (typeof all)[number]) => [c.id, { ...c, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const cat of byId.values()) {
      if (cat.parentId && byId.has(cat.parentId)) {
        byId.get(cat.parentId)!.children.push(cat);
      } else if (!cat.parentId) {
        roots.push(cat);
      }
    }
    return roots;
  }

  async findAllFlat() {
    return this.prisma.serviceCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.serviceCategory.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException('Parent category not found');
    }

    const baseSlug = slugify(dto.name);
    const slug = await this.uniqueSlug(baseSlug);

    return this.prisma.serviceCategory.create({
      data: { name: dto.name, slug, parentId: dto.parentId, icon: dto.icon },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.getOrThrow(id);
    return this.prisma.serviceCategory.update({
      where: { id },
      data: {
        name: dto.name,
        icon: dto.icon,
        isActive: dto.isActive,
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.getOrThrow(id);
    // Soft delete: categories may already be referenced by services/providers.
    return this.prisma.serviceCategory.update({ where: { id }, data: { isActive: false } });
  }

  // --- Category attributes (spec §5, §11, §30) ---

  async getAttributesForCategory(
    categoryId: string,
    options: { publicOnly?: boolean } = {},
  ): Promise<CategoryAttribute[]> {
    return this.prisma.categoryAttribute.findMany({
      where: {
        categoryId,
        isActive: true,
        ...(options.publicOnly ? { isPublic: true } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createAttribute(categoryId: string, dto: CreateAttributeDto) {
    await this.getOrThrow(categoryId);
    this.assertOptionsValid(dto.type, dto.options);

    const slug = slugify(dto.name);
    const existing = await this.prisma.categoryAttribute.findUnique({
      where: { categoryId_slug: { categoryId, slug } },
    });
    if (existing) throw new BadRequestException('An attribute with this name already exists in this category');

    const maxOrder = await this.prisma.categoryAttribute.aggregate({
      where: { categoryId },
      _max: { displayOrder: true },
    });

    return this.prisma.categoryAttribute.create({
      data: {
        categoryId,
        name: dto.name,
        slug,
        description: dto.description,
        type: dto.type,
        isRequired: dto.isRequired ?? false,
        isFilterable: dto.isFilterable ?? false,
        isSearchable: dto.isSearchable ?? false,
        isPublic: dto.isPublic ?? true,
        displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
        options: OPTION_TYPES.includes(dto.type) ? dto.options : undefined,
      },
    });
  }

  async updateAttribute(id: string, dto: UpdateAttributeDto) {
    const attribute = await this.getAttributeOrThrow(id);
    const type = dto.type ?? attribute.type;
    if (dto.options !== undefined || dto.type !== undefined) {
      this.assertOptionsValid(type, dto.options ?? (attribute.options as string[] | undefined));
    }

    return this.prisma.categoryAttribute.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        isRequired: dto.isRequired,
        isFilterable: dto.isFilterable,
        isSearchable: dto.isSearchable,
        isPublic: dto.isPublic,
        displayOrder: dto.displayOrder,
        isActive: dto.isActive,
        ...(dto.options !== undefined ? { options: OPTION_TYPES.includes(type) ? dto.options : undefined } : {}),
      },
    });
  }

  async removeAttribute(id: string) {
    await this.getAttributeOrThrow(id);
    // A hard delete (per spec §15's explicit DELETE endpoint) — values
    // cascade via the schema's onDelete: Cascade. Admins who just want to
    // hide a field without losing history should use PATCH { isActive:
    // false } instead (spec §30's "Disable attributes").
    await this.prisma.categoryAttribute.delete({ where: { id } });
    return { success: true };
  }

  async reorderAttributes(categoryId: string, dto: ReorderAttributesDto) {
    await this.getOrThrow(categoryId);
    const attributes = await this.prisma.categoryAttribute.findMany({ where: { categoryId } });
    const validIds = new Set(attributes.map((a: (typeof attributes)[number]) => a.id));
    for (const id of dto.attributeIds) {
      if (!validIds.has(id)) throw new BadRequestException('One or more attribute IDs do not belong to this category');
    }

    await this.prisma.$transaction(
      dto.attributeIds.map((id, index) =>
        this.prisma.categoryAttribute.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );
    return this.getAttributesForCategory(categoryId);
  }

  // The single place raw client input for an attribute value is checked
  // (spec §25/§26) — never trust the frontend, and never let a client
  // submit a value for an attribute that doesn't belong to the category
  // it claims, or that isn't active.
  validateAttributeValue(attribute: CategoryAttribute, rawValue: unknown): NormalizedAttributeValue {
    const empty: NormalizedAttributeValue = { textValue: null, numberValue: null, booleanValue: null, jsonValue: null };

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (attribute.isRequired) {
        throw new BadRequestException(`"${attribute.name}" is required`);
      }
      return empty;
    }

    switch (attribute.type) {
      case 'TEXT':
        if (typeof rawValue !== 'string') throw new BadRequestException(`"${attribute.name}" must be text`);
        return { ...empty, textValue: rawValue };

      case 'NUMBER': {
        const num = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (Number.isNaN(num)) throw new BadRequestException(`"${attribute.name}" must be a number`);
        return { ...empty, numberValue: num };
      }

      case 'BOOLEAN':
        if (typeof rawValue !== 'boolean') throw new BadRequestException(`"${attribute.name}" must be true or false`);
        return { ...empty, booleanValue: rawValue };

      case 'PRICE': {
        const price = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (Number.isNaN(price) || price < 0) throw new BadRequestException(`"${attribute.name}" must be a valid price`);
        return { ...empty, numberValue: price };
      }

      case 'SELECT': {
        const options = (attribute.options as string[] | null) ?? [];
        if (typeof rawValue !== 'string' || !options.includes(rawValue)) {
          throw new BadRequestException(`"${attribute.name}" must be one of: ${options.join(', ')}`);
        }
        return { ...empty, textValue: rawValue };
      }

      case 'MULTI_SELECT': {
        const options = (attribute.options as string[] | null) ?? [];
        if (!Array.isArray(rawValue) || rawValue.some((v) => typeof v !== 'string' || !options.includes(v))) {
          throw new BadRequestException(`"${attribute.name}" must be a subset of: ${options.join(', ')}`);
        }
        return { ...empty, jsonValue: rawValue };
      }

      default:
        throw new BadRequestException(`Unsupported attribute type for "${attribute.name}"`);
    }
  }

  private assertOptionsValid(type: AttributeType, options?: string[]) {
    if (OPTION_TYPES.includes(type)) {
      if (!options || options.length === 0) {
        throw new BadRequestException(`${type} attributes require at least one option`);
      }
    }
  }

  private async getAttributeOrThrow(id: string) {
    const attribute = await this.prisma.categoryAttribute.findUnique({ where: { id } });
    if (!attribute) throw new NotFoundException('Attribute not found');
    return attribute;
  }

  private async getOrThrow(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let n = 1;
    // Small collision loop; category counts are low so this is fine.
    while (await this.prisma.serviceCategory.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }
}
