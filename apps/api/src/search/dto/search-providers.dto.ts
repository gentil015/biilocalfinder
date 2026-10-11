import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const SORT_OPTIONS = [
  'recommended',
  'nearest',
  'highest_rated',
  'lowest_price',
  'most_experienced',
  'available_now',
] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export class SearchProvidersDto {
  @ApiPropertyOptional({
    description:
      'Free-text search across provider business name, service name/description, category name, and offering title/description (word-based, e.g. "wedding photographer" matches a provider offering "Wedding Photography" regardless of business name)',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number = 15;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minExperience?: number;

  @ApiPropertyOptional({ description: 'Only providers marked AVAILABLE right now' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableNow?: boolean;

  @ApiPropertyOptional({ description: 'Only VERIFIED providers' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ enum: SORT_OPTIONS, default: 'recommended' })
  @IsOptional()
  @IsIn(SORT_OPTIONS)
  sort?: SortOption = 'recommended';

  @ApiPropertyOptional({
    type: Object,
    description:
      'Category attribute filters, keyed by attribute slug, e.g. attributes[droneAvailable]=true — only attributes marked isFilterable on the resolved category are honored; anything else is rejected.',
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}
