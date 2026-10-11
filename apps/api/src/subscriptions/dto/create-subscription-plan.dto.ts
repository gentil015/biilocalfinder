import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BillingInterval, ProviderType } from '@prisma/client';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ enum: ProviderType, description: 'Which of the four workspace types this plan is for' })
  @IsEnum(ProviderType)
  workspaceType: ProviderType;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ enum: BillingInterval })
  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxServices?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxPortfolioImages?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxMonthlyRequests?: number;

  @ApiProperty({ required: false, description: 'TEAM/BUSINESS only — caps active workspace members' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxTeamMembers?: number;

  @ApiProperty({ required: false, description: 'AGENCY only — caps the represented-provider roster' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxManagedProviders?: number;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  features?: Record<string, unknown>;
}
