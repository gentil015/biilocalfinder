import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProviderApplicationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProviderApplicationsService } from './provider-applications.service';
import { SubmitProviderApplicationDto } from './dto/submit-application.dto';
import { ReviewProviderApplicationDto, RejectProviderApplicationDto } from './dto/review-application.dto';

// Client-facing side of "become a provider". Deliberately mounted under
// /provider-applications rather than /provider/* — those routes are all
// PROVIDER-role guarded, and an applicant is still a CLIENT until approved.
@ApiTags('provider-applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('provider-applications')
export class ProviderApplicationsController {
  constructor(private service: ProviderApplicationsService) {}

  @Post()
  submit(@CurrentUser() user: { id: string }, @Body() dto: SubmitProviderApplicationDto) {
    return this.service.submit(user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentUser() user: { id: string }) {
    return this.service.listMine(user.id);
  }
}

// ---------- Admin review ----------

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/provider-applications')
export class AdminProviderApplicationsController {
  constructor(private service: ProviderApplicationsService) {}

  // Enum-piped rather than a bare string: an unknown value would otherwise
  // reach Prisma and surface as a 500 from deep inside the query layer.
  @Get()
  list(
    @Query('status', new ParseEnumPipe(ProviderApplicationStatus, { optional: true }))
    status?: ProviderApplicationStatus,
  ) {
    return this.service.listForReview(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() admin: { id: string }, @Param('id') id: string, @Body() dto: ReviewProviderApplicationDto) {
    return this.service.approve(id, admin.id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUser() admin: { id: string }, @Param('id') id: string, @Body() dto: RejectProviderApplicationDto) {
    return this.service.reject(id, admin.id, dto);
  }
}