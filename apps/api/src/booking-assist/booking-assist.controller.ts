import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { BookingAssistService } from './booking-assist.service';
import { BookingAssistDto } from './dto/booking-assist.dto';

@ApiTags('booking-assist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('booking-assist')
export class BookingAssistController {
  constructor(private bookingAssistService: BookingAssistService) {}

  // Tighter than the app-wide 100/min default (app.module.ts) — this
  // endpoint fans out to a paid external AI call per turn, same reasoning
  // as the request-assist throttle.
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Roles('CLIENT')
  @Post('suggest')
  suggest(@Body() dto: BookingAssistDto) {
    return this.bookingAssistService.suggest(dto);
  }
}
