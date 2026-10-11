import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProviderType } from '@prisma/client';

export class SubmitProviderApplicationDto {
  @ApiProperty({ enum: ProviderType, description: 'Seeds the workspace and provider type on approval.' })
  @IsEnum(ProviderType)
  providerType: ProviderType;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  businessName: string;

  @ApiPropertyOptional({ description: 'What you offer and who you are best for.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ description: 'Business/AGENCY only.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  registrationNumber?: string;

  @ApiPropertyOptional({ description: 'National ID number — helps an admin verify identity.' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(200)
  websiteUrl?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Service category slugs you intend to offer, e.g. ["plumbing", "painting"].',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Matches(/^[a-z0-9-]+$/, { each: true })
  categories?: string[];
}