import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProviderType, SubscriptionStatus } from '@prisma/client';
import { IsBooleanString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListSubscriptionsQueryDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  providerType?: ProviderType;

  @ApiPropertyOptional({ description: 'Only subscriptions with billing issues' })
  @IsOptional()
  @IsBooleanString()
  billingIssues?: string;

  @ApiPropertyOptional({ description: 'Search provider, account email, or plan', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  page?: string;
}
