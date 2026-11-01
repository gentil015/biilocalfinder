import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AppealStatus,
  FraudReportCategory,
  FraudReportStatus,
  RestrictionType,
  RiskAssessmentStatus,
  SecurityEventType,
  VerificationCheckStatus,
  VerificationCheckType,
} from '@prisma/client';

const USER_SUBMITTED_EVENTS: SecurityEventType[] = [
  SecurityEventType.PROFILE_UPDATED,
  SecurityEventType.BOOKING_CREATED,
  SecurityEventType.BOOKING_CANCELLED,
  SecurityEventType.REVIEW_SUBMITTED,
];

export class CreateSecurityEventDto {
  @ApiProperty({ enum: USER_SUBMITTED_EVENTS })
  @IsIn(USER_SUBMITTED_EVENTS)
  eventType: SecurityEventType;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dedupeKey?: string;
}

export class CreateFraudReportDto {
  @ApiProperty()
  @IsString()
  reportedUserId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ enum: FraudReportCategory })
  @IsEnum(FraudReportCategory)
  category: FraudReportCategory;

  @ApiProperty({ minLength: 20, maxLength: 4000 })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description: string;
}

export class CreateProviderFraudReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ enum: FraudReportCategory })
  @IsEnum(FraudReportCategory)
  category: FraudReportCategory;

  @ApiProperty({ minLength: 20, maxLength: 4000 })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description: string;
}

export class ListTrustRecordsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ enum: FraudReportStatus })
  @IsOptional()
  @IsEnum(FraudReportStatus)
  status?: FraudReportStatus;
}

export class ListAppealsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ enum: AppealStatus })
  @IsOptional()
  @IsEnum(AppealStatus)
  status?: AppealStatus;
}

export class ReviewRiskAssessmentDto {
  @ApiProperty({ enum: [RiskAssessmentStatus.REVIEWED, RiskAssessmentStatus.DISMISSED, RiskAssessmentStatus.CONFIRMED] })
  @IsIn([RiskAssessmentStatus.REVIEWED, RiskAssessmentStatus.DISMISSED, RiskAssessmentStatus.CONFIRMED])
  status: RiskAssessmentStatus;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  note: string;
}

export class UpdateFraudReportDto {
  @ApiProperty({ enum: FraudReportStatus })
  @IsEnum(FraudReportStatus)
  status: FraudReportStatus;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolution?: string;
}

export class CreateRestrictionDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: RestrictionType })
  @IsEnum(RestrictionType)
  restrictionType: RestrictionType;

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional({ description: 'Required for a temporary suspension; omitted for permanent restrictions.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateProviderVerificationCheckDto {
  @ApiProperty()
  @IsString()
  providerId: string;

  @ApiProperty({ enum: VerificationCheckType })
  @IsEnum(VerificationCheckType)
  checkType: VerificationCheckType;

  @ApiProperty({ enum: VerificationCheckStatus })
  @IsEnum(VerificationCheckStatus)
  status: VerificationCheckStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class RestrictionAppealDto {
  @ApiProperty({ minLength: 10, maxLength: 2000 })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;
}

export class ReviewAppealDto {
  @ApiProperty({ enum: [AppealStatus.APPROVED, AppealStatus.REJECTED] })
  @IsIn([AppealStatus.APPROVED, AppealStatus.REJECTED])
  status: AppealStatus;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  decisionNote: string;
}

export class LiftRestrictionDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason: string;
}

export class UpdateFraudRuleDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  points?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 8760 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8760)
  windowHours?: number;
}
