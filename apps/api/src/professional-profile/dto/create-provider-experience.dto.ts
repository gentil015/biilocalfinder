import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProviderExperienceDto {
  @ApiProperty({ description: 'Job title or role' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @ApiProperty({ description: 'Company, client or organization' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  organization: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD); omit when isCurrent is true' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Currently working in this role' })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order, lowest first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
