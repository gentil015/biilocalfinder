import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { RegisterPushSubscriptionDto } from './dto/register-push-subscription.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findMine(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.findMine(user.id, Number(page) || 1, Number(limit) || 20);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { id: string }) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Patch('preferences')
  updatePreference(@CurrentUser() user: { id: string }, @Body() dto: UpdatePreferenceDto) {
    return this.notificationsService.updatePreference(user.id, dto);
  }

  @Post('push-subscriptions')
  registerPush(@CurrentUser() user: { id: string }, @Body() dto: RegisterPushSubscriptionDto) {
    return this.notificationsService.registerPushSubscription(user.id, dto);
  }

  @Delete('push-subscriptions')
  removePush(@CurrentUser() user: { id: string }, @Body('endpoint') endpoint: string) {
    return this.notificationsService.removePushSubscription(user.id, endpoint);
  }
}
