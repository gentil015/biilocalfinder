import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewProviderApplicationDto {
  @ApiPropertyOptional({
    description: 'Shown to the applicant. Required when rejecting, so they know what to fix.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectProviderApplicationDto {
  @ApiProperty({ description: 'Required: the applicant is told why.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}