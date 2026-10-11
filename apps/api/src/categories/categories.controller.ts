import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { ReorderAttributesDto } from './dto/reorder-attributes.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  // Public — used by the home page and search filters.
  @Get()
  findAll(@Query('flat') flat?: string) {
    return flat === 'true' ? this.categoriesService.findAllFlat() : this.categoriesService.findTree();
  }

  // Public — drives the dynamic provider/client forms (spec §10) and
  // filter UI (spec §16). Non-public attributes (isPublic: false) are
  // excluded here.
  @Get(':id/attributes')
  getAttributes(@Param('id') id: string) {
    return this.categoriesService.getAttributesForCategory(id, { publicOnly: true });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  // --- Admin attribute management (spec §4, §11, §30) ---

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/attributes')
  createAttribute(@Param('id') categoryId: string, @Body() dto: CreateAttributeDto) {
    return this.categoriesService.createAttribute(categoryId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':id/attributes/reorder')
  reorderAttributes(@Param('id') categoryId: string, @Body() dto: ReorderAttributesDto) {
    return this.categoriesService.reorderAttributes(categoryId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('attributes/:attributeId')
  updateAttribute(@Param('attributeId') attributeId: string, @Body() dto: UpdateAttributeDto) {
    return this.categoriesService.updateAttribute(attributeId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Delete('attributes/:attributeId')
  removeAttribute(@Param('attributeId') attributeId: string) {
    return this.categoriesService.removeAttribute(attributeId);
  }

  // Full (including non-public/inactive) attribute list, for the admin UI.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get(':id/attributes/admin')
  getAttributesForAdmin(@Param('id') categoryId: string) {
    return this.categoriesService.getAttributesForCategory(categoryId, { publicOnly: false });
  }
}
