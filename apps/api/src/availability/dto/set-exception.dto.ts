import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class SetAvailabilityExceptionDto {
  @ApiProperty({ example: '2026-12-25' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'false blocks this date, true explicitly opens an otherwise-off day' })
  @IsBoolean()
  isAvailable: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
