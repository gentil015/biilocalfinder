import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProviderEducationDto {
  @ApiProperty({ description: 'School, college or training institution' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  school: string;

  @ApiPropertyOptional({ description: 'Degree, certificate or diploma' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  degree?: string;

  @ApiPropertyOptional({ description: 'Field of study or specialization' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  fieldOfStudy?: string;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional({ description: 'ISO date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

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
