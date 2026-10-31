import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const BUSINESS_ANALYTICS_PERIODS = ['7', '30', '90'] as const;

export class BusinessAnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: BUSINESS_ANALYTICS_PERIODS,
    default: '30',
    description: 'Look-back window in days (7, 30 or 90). Defaults to 30.',
  })
  @IsOptional()
  @IsIn(BUSINESS_ANALYTICS_PERIODS)
  days?: string;
}
