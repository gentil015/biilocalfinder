import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { SetWeeklyScheduleDto } from './dto/set-weekly-schedule.dto';
import { SetAvailabilityExceptionDto } from './dto/set-exception.dto';
import { SetAvailabilityStatusDto } from './dto/set-availability-status.dto';

@ApiTags('availability')
@Controller()
export class AvailabilityController {
  constructor(private availability: AvailabilityService) {}

  // ---- Provider: manage their own schedule ----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Get('provider/availability')
  getMine(@CurrentUser() user: { id: string }) {
    return this.availability.getMine(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Put('provider/availability/weekly')
  setWeekly(@CurrentUser() user: { id: string }, @Body() dto: SetWeeklyScheduleDto) {
    return this.availability.setWeeklySchedule(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Post('provider/availability/status')
  setStatus(@CurrentUser() user: { id: string }, @Body() dto: SetAvailabilityStatusDto) {
    return this.availability.setStatus(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Post('provider/availability/exceptions')
  setException(@CurrentUser() user: { id: string }, @Body() dto: SetAvailabilityExceptionDto) {
    return this.availability.setException(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Delete('provider/availability/exceptions/:id')
  removeException(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.availability.removeException(user.id, id);
  }

  // ---- Public: what a provider's page / search cards show ----

  @Get('providers/:id/availability')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.availability.summaryForProvider(id);
  }
}
