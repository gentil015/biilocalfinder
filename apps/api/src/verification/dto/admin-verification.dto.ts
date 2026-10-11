import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { MAX_VALIDITY_MONTHS } from '../verification.constants';

export class ApproveVerificationDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_VALIDITY_MONTHS, description: 'How long the approval lasts (default 12)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_VALIDITY_MONTHS)
  validityMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Rejecting and suspending both require a reason — it is shown to the
// provider and kept in the audit trail.
export class VerificationReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class ReinstateVerificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VerificationQueueQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiPropertyOptional({ enum: VerificationType })
  @IsOptional()
  @IsEnum(VerificationType)
  type?: VerificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;
}
