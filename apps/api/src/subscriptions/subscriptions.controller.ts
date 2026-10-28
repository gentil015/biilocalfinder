import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProviderType } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';

@ApiTags('subscriptions')
@Controller()
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  // Public — providers browse plans before subscribing. ?workspaceType=
  // narrows to the plans a given workspace type can actually subscribe
  // to (spec §7); omitted, returns every plan across all four types.
  @Get('subscription/plans')
  listPlans(@Query('workspaceType') workspaceType?: ProviderType) {
    return this.subscriptionsService.listPlans(workspaceType);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/subscription-plans')
  createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch('admin/subscription-plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: Partial<CreateSubscriptionPlanDto>) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.billing.manage')
  @Post('subscriptions')
  subscribe(@CurrentUser() user: { id: string }, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.subscribe(user.id, dto.planId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.billing.manage')
  @Get('subscriptions/current')
  current(@CurrentUser() user: { id: string }) {
    return this.subscriptionsService.current(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.billing.manage')
  @Get('subscriptions/history')
  history(@CurrentUser() user: { id: string }) {
    return this.subscriptionsService.history(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.billing.manage')
  @Get('subscriptions/usage')
  usage(@CurrentUser() user: { id: string }) {
    return this.subscriptionsService.usage(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.billing.manage')
  @Post('subscriptions/:id/cancel')
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.subscriptionsService.cancel(user.id, id);
  }
}
