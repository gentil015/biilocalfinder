import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AssistantJwtAuthGuard } from '../auth/guards/assistant-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CustomerAssistService } from './customer-assist.service';
import { CustomerAssistDto } from './dto/customer-assist.dto';

// Public by design: "Ask BII Assistant" should help visitors who are still
// deciding to join, not just logged-in members. A valid session is optional
// and only unlocks the caller's own live data (their requests, quotes,
// bookings, offerings, availability) plus confirmed write actions. Guests
// still get the full public guide. Abuse is bounded by the per-IP throttle
// below, because every turn fans out to a paid AI call.
@ApiTags('customer-assist')
@Controller('customer-assist')
export class CustomerAssistController {
  constructor(private customerAssistService: CustomerAssistService) {}

  // Tighter than the app-wide 100/min default — this endpoint fans out to a
  // paid external AI call per turn, same reasoning as booking-assist.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(AssistantJwtAuthGuard)
  @Post('chat')
  chat(
    @Body() dto: CustomerAssistDto,
    @CurrentUser() user?: { id: string; role: string },
    @Headers('x-workspace-id') workspaceId?: string,
  ) {
    return this.customerAssistService.chat(dto, user, workspaceId);
  }
}
