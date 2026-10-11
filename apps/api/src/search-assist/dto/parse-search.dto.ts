import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_SEARCH_ASSIST_TEXT_LENGTH, SEARCH_ASSIST_LANGUAGES } from '../search-assist.interface';

export class ParseSearchDto {
  @ApiProperty({
    description: 'Natural-language description of what the client needs, e.g. "install a CCTV system for my small shop in Kigali"',
    maxLength: MAX_SEARCH_ASSIST_TEXT_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_SEARCH_ASSIST_TEXT_LENGTH)
  message!: string;

  @ApiPropertyOptional({ enum: SEARCH_ASSIST_LANGUAGES, description: 'Preferred reply language; defaults to English' })
  @IsOptional()
  @IsIn(SEARCH_ASSIST_LANGUAGES)
  language?: (typeof SEARCH_ASSIST_LANGUAGES)[number];

  @ApiPropertyOptional({ description: 'The searcher\'s current latitude, used only as a "near me" fallback' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Preferred radius around lat/lng in km (1-200), used only with lat/lng' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;
}
