import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.favoritesService.list(user.id);
  }

  @Post(':providerId')
  add(@CurrentUser() user: { id: string }, @Param('providerId') providerId: string) {
    return this.favoritesService.add(user.id, providerId);
  }

  @Delete(':providerId')
  remove(@CurrentUser() user: { id: string }, @Param('providerId') providerId: string) {
    return this.favoritesService.remove(user.id, providerId);
  }
}
