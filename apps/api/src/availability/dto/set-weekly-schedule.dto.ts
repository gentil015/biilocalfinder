import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';

export class WeeklySlotDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Sunday .. 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @ApiProperty({ example: '17:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @ApiProperty({ required: false, default: true, description: 'false (or simply omitting a day) means unavailable that weekday' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Replaces the whole week in one call — matches how a provider actually
// edits their hours (a 7-row table), rather than one day per request. Days
// not included are treated as unavailable.
export class SetWeeklyScheduleDto {
  @ApiProperty({ type: [WeeklySlotDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotDto)
  days: WeeklySlotDto[];
}
