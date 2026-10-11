import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_REVIEW_PHOTOS = 5;

const Rating = () => applyDecorators(IsInt(), Min(1), Max(5));

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5, description: 'Overall rating' })
  @Rating()
  rating: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Rating()
  qualityRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Rating()
  communicationRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Rating()
  professionalismRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'Value for money' })
  @IsOptional()
  @Rating()
  valueRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({ description: 'storageKeys returned by POST /reviews/photos', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REVIEW_PHOTOS)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  photoKeys?: string[];
}
