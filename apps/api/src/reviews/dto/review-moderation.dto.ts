import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RespondToReviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text: string;
}

export class HideReviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

export class ListReviewsQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() page?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() limit?: string;

  @ApiPropertyOptional({ enum: ['recent', 'highest', 'lowest'] })
  @IsOptional()
  @IsIn(['recent', 'highest', 'lowest'])
  sort?: 'recent' | 'highest' | 'lowest';

  @ApiPropertyOptional({ description: 'Only reviews from verified bookings' })
  @IsOptional()
  @IsIn(['true', 'false'])
  verifiedOnly?: string;

  @ApiPropertyOptional({ description: 'Only reviews with photos' })
  @IsOptional()
  @IsIn(['true', 'false'])
  withPhotos?: string;

  @ApiPropertyOptional({ description: 'Provider inbox: only reviews not yet answered' })
  @IsOptional()
  @IsIn(['true', 'false'])
  unanswered?: string;
}
