import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { CustomerAssistService } from './customer-assist.service';
import { CustomerAssistDto } from './dto/customer-assist.dto';

// Public by design: "Ask BII Assistant" should help visitors who are still
// deciding to join, not just logged-in members. It only ever returns real,
// public marketplace data (service categories + provider profiles), never
// personal info — so auth is unnecessary. Abuse is instead bounded by the
// per-IP throttle below, because every turn fans out to a paid AI call.
@ApiTags('customer-assist')
@Controller('customer-assist')
export class CustomerAssistController {
  constructor(private customerAssistService: CustomerAssistService) {}

  // Tighter than the app-wide 100/min default — this endpoint fans out to a
  // paid external AI call per turn, same reasoning as booking-assist.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('chat')
  chat(@Body() dto: CustomerAssistDto) {
    return this.customerAssistService.chat(dto);
  }
}