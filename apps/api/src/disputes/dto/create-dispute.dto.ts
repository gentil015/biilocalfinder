import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DisputeCategory } from '@prisma/client';

export class CreateDisputeDto {
  @ApiProperty()
  @IsUUID()
  bookingId: string;

  @ApiProperty({ enum: DisputeCategory })
  @IsEnum(DisputeCategory)
  category: DisputeCategory;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
