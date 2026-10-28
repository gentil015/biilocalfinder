import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PortfolioService } from './portfolio.service';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { AddPortfolioImageDto } from './dto/add-portfolio-image.dto';

@ApiTags('portfolio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireWorkspacePermission('catalog.manage')
@Controller('providers/me/portfolios')
export class PortfolioController {
  constructor(private portfolioService: PortfolioService) {}

  @Get()
  findMine(@CurrentUser() user: { id: string }) {
    return this.portfolioService.findMine(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreatePortfolioDto) {
    return this.portfolioService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() dto: UpdatePortfolioDto) {
    return this.portfolioService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.portfolioService.remove(user.id, id);
  }

  @Post(':id/images')
  addImage(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AddPortfolioImageDto,
  ) {
    return this.portfolioService.addImage(user.id, id, dto);
  }

  @Delete('images/:imageId')
  removeImage(@CurrentUser() user: { id: string }, @Param('imageId') imageId: string) {
    return this.portfolioService.removeImage(user.id, imageId);
  }
}
