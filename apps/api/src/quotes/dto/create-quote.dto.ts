import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const MAX_LIST_ITEMS = 20;
const MAX_ATTACHMENTS = 5;

export class QuoteAttachmentRefDto {
  @ApiProperty({ description: 'storageKey returned by POST /quotes/attachments' })
  @IsString()
  @MaxLength(300)
  storageKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;
}

export class CreateQuoteDto {
  @ApiProperty()
  @IsUUID()
  requestId: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  estimatedDuration?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  proposedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: 'e.g. "Paint and brushes included" or "Client provides replacement parts"' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  materials?: string;

  @ApiPropertyOptional({ type: [String], description: "What's included in the price" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  includedItems?: string[];

  @ApiPropertyOptional({ type: [String], description: "What's NOT included — extra costs the client should expect" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_LIST_ITEMS)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  excludedItems?: string[];

  @ApiPropertyOptional({ description: 'ISO date the quote expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ type: [QuoteAttachmentRefDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => QuoteAttachmentRefDto)
  attachments?: QuoteAttachmentRefDto[];
}
