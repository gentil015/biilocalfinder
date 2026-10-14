import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, Min, ValidateIf } from 'class-validator';
import { AvailabilityStatus } from '@prisma/client';

export class UpdateProviderProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  serviceRadiusKm?: number;

  @ApiProperty({ required: false, enum: AvailabilityStatus })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  // Logo/photo URL returned by POST /files/upload. An empty string clears it
  // (falls back to the account avatar on the public profile), so it is
  // exempted from URL validation in that one case.
  @ApiPropertyOptional({ description: 'Logo URL from POST /files/upload; empty string clears it' })
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== '')
  @IsUrl({ require_tld: false }) // allow localhost/MinIO URLs in dev
  logoUrl?: string;
}
