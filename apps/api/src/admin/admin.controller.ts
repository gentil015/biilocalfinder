import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { ListSubscriptionsQueryDto } from './dto/list-subscriptions-query.dto';
import { BusinessAnalyticsQueryDto } from './dto/business-analytics-query.dto';
import { AdminUpdateProviderDto } from './dto/admin-update-provider.dto';
import { AdminUnverifyProviderDto, AdminVerifyProviderDto } from './dto/admin-provider-verification.dto';

// Everything here is admin-only — categories/services/subscription plans/
// provider verification/reports/disputes each have their own admin-gated
// endpoints in their own modules (spec §39: "keep domain logic inside
// appropriate modules"); this controller covers what's left: platform
// analytics, user management, and the audit trail.
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('business')
  business(@Query() query: BusinessAnalyticsQueryDto) {
    return this.adminService.businessAnalytics(query);
  }

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/suspend')
  suspend(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.adminService.setUserStatus(admin.id, id, 'SUSPENDED');
  }

  @Patch('users/:id/activate')
  activate(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.adminService.setUserStatus(admin.id, id, 'ACTIVE');
  }

  @Delete('users/:id')
  deleteUser(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.adminService.deleteUser(admin.id, id);
  }

  @Patch('providers/:id')
  updateProvider(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: AdminUpdateProviderDto,
  ) {
    return this.adminService.updateProvider(admin.id, id, dto);
  }

  @Post('providers/:id/verify')
  verifyProvider(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: AdminVerifyProviderDto,
  ) {
    return this.adminService.verifyProvider(admin.id, id, dto.note);
  }

  @Post('providers/:id/unverify')
  unverifyProvider(
    @CurrentUser() admin: { id: string },
    @Param('id') id: string,
    @Body() dto: AdminUnverifyProviderDto,
  ) {
    return this.adminService.unverifyProvider(admin.id, id, dto.reason);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.adminService.auditLogs(query);
  }

  @Get('subscriptions')
  subscriptions(@Query() query: ListSubscriptionsQueryDto) {
    return this.adminService.listSubscriptions(query);
  }
}
