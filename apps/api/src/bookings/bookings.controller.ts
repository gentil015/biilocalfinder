import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// NOTE: intentionally no POST /bookings/:id/payment or similar endpoint —
// the platform never processes client-to-provider service payments (spec
// §16). Booking.paymentArrangementNote is surfaced to the frontend instead.

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Roles('CLIENT')
  @Get('mine')
  findMineAsClient(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findMine(user.id, 'CLIENT');
  }

  @Roles('PROVIDER')
  @Get('provider/mine')
  findMineAsProvider(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findMine(user.id, 'PROVIDER');
  }

  @Roles('CLIENT', 'PROVIDER')
  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.bookingsService.findOne(id, user.id);
  }

  @Roles('CLIENT', 'PROVIDER')
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, user.id, dto);
  }
}
