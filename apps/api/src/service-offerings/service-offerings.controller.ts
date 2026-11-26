import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ServiceOfferingsService } from './service-offerings.service';
import { CreateOfferingDto } from './dto/create-offering.dto';
import { UpdateOfferingDto } from './dto/update-offering.dto';

@ApiTags('service-offerings')
@Controller()
export class ServiceOfferingsController {
  constructor(private offeringsService: ServiceOfferingsService) {}

  @Get('service-offerings')
  listPublic(
    @Query('providerId') providerId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.offeringsService.listPublic({
      providerId,
      serviceId,
      categoryId,
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('catalog/offerings')
  listCatalogue(
    @Query('providerId') providerId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.offeringsService.listPublic({
      providerId,
      serviceId,
      categoryId,
      q,
      limit: limit ? Number(limit) : undefined,
    });
  }

  // Public — the dedicated service offering page (spec §19). Stays public
  // via OptionalJwtAuthGuard, but records a VIEW_SERVICE interaction when
  // the viewer happens to be logged in (same pattern as the provider
  // profile route).
  @UseGuards(OptionalJwtAuthGuard)
  @Get('service-offerings/:id')
  findPublic(@CurrentUser() user: { id: string } | null, @Param('id') id: string) {
    return this.offeringsService.findPublic(id, user?.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('catalog.manage')
  @Post('provider/service-offerings')
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateOfferingDto) {
    return this.offeringsService.create(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('catalog.manage')
  @Get('provider/service-offerings')
  findMine(@CurrentUser() user: { id: string }) {
    return this.offeringsService.findMine(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('catalog.manage')
  @Get('provider/service-offerings/:id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.offeringsService.findOneForOwner(user.id, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('catalog.manage')
  @Patch('provider/service-offerings/:id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdateOfferingDto) {
    return this.offeringsService.update(user.id, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('catalog.manage')
  @Delete('provider/service-offerings/:id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.offeringsService.remove(user.id, id);
  }
}
