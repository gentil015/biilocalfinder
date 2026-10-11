import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AvailabilityStatus } from '@prisma/client';

// The manual "pause" toggle — separate from the weekly schedule. UNAVAILABLE
// takes a provider off the calendar entirely (e.g. on leave) regardless of
// what their weekly hours say.
export class SetAvailabilityStatusDto {
  @ApiProperty({ enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;
}
