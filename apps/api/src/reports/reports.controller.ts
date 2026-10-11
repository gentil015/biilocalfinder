import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Roles('CLIENT', 'PROVIDER')
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: string, @Query('category') category?: string, @Query('page') page?: string) {
    return this.reportsService.findAll(status, category, Number(page) || 1);
  }

  @Roles('ADMIN')
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.findOneWithTarget(id);
  }

  @Roles('ADMIN')
  @Patch(':id/assign')
  assign(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.reportsService.assign(id, admin.id);
  }

  @Roles('ADMIN')
  @Patch(':id/resolve')
  resolve(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveReportDto) {
    return this.reportsService.resolve(id, admin.id, dto);
  }
}
