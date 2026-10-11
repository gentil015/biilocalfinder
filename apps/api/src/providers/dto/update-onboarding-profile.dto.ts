import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

export class UpdateOnboardingProfileDto {
  // INDIVIDUAL: full name. TEAM: team/group name. BUSINESS: registered
  // business name. AGENCY: agency name. One shared field (same one
  // `UpdateProviderProfileDto` already exposes) rather than four
  // near-duplicate name columns.
  @ApiProperty({ required: false, description: 'Full name (individual) or organization name (team/business/agency)' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @ApiProperty({ required: false, description: 'Short professional bio (individual) or description (team/business/agency)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiProperty({ required: false, description: 'BUSINESS: registration number, optional' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNumber?: string;

  @ApiProperty({ required: false, description: 'TEAM leader/owner, or BUSINESS/AGENCY authorized representative' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  representativeName?: string;

  @ApiProperty({ required: false, description: 'TEAM: approximate member count, informational only' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  teamSize?: number;

  // TEAM/BUSINESS/AGENCY logo — a URL returned by POST /files/upload.
  // INDIVIDUAL reuses the user's existing avatarUrl instead.
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_tld: false }) // allow localhost/MinIO URLs in dev
  logoUrl?: string;
}
