import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { WorkspaceScoped } from '../common/workspace/workspace-scoped.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateRequestPrivacyDto } from './dto/update-request-privacy.dto';

@ApiTags('service-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private serviceRequestsService: ServiceRequestsService) {}

  @Roles('CLIENT')
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateServiceRequestDto) {
    return this.serviceRequestsService.create(user.id, dto);
  }

  @Roles('CLIENT')
  @Get('mine')
  findMine(@CurrentUser() user: { id: string }) {
    return this.serviceRequestsService.findMine(user.id);
  }

  @RequireWorkspacePermission('requests.view')
  @Get('incoming')
  findIncoming(@CurrentUser() user: { id: string }) {
    return this.serviceRequestsService.findIncoming(user.id);
  }

  @Roles('CLIENT', 'PROVIDER')
  @WorkspaceScoped()
  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.serviceRequestsService.findOne(id, user.id);
  }

  @Roles('CLIENT')
  @Patch(':id/privacy')
  setPrivacy(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateRequestPrivacyDto,
  ) {
    return this.serviceRequestsService.setPrivacy(id, user.id, dto.isPublic);
  }

  @Roles('CLIENT')
  @Delete(':id')
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.serviceRequestsService.cancel(id, user.id);
  }
}
