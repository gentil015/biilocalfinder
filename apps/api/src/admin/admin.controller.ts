import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';

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

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/suspend')
  suspend(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.adminService.setUserStatus(admin.id, id, 'SUSPENDED');
  }

  @Patch('users/:id/activate')
  activate(@CurrentUser() admin: { id: string }, @Param('id') id: string) {
    return this.adminService.setUserStatus(admin.id, id, 'ACTIVE');
  }

  @Get('audit-logs')
  auditLogs(@Query('page') page?: string) {
    return this.adminService.auditLogs(Number(page) || 1);
  }
}
