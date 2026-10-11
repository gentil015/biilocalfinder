import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slugify';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  findAll(categoryId?: string) {
    return this.prisma.service.findMany({
      where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(dto: CreateServiceDto) {
    const category = await this.prisma.serviceCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException('Category not found');

    const slug = slugify(dto.name);
    const existing = await this.prisma.service.findUnique({
      where: { categoryId_slug: { categoryId: dto.categoryId, slug } },
    });
    if (existing) throw new BadRequestException('A service with this name already exists in that category');

    return this.prisma.service.create({
      data: { categoryId: dto.categoryId, name: dto.name, slug, description: dto.description },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    return this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({ where: { id }, data: { isActive: false } });
  }
}
