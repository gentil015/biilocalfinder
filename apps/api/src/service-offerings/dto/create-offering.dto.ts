import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OfferingPriceType } from '@prisma/client';

export class OfferingImageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  storageKey: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  url?: string;
}

export class CreateOfferingDto {
  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({ required: false, enum: OfferingPriceType })
  @IsOptional()
  @IsEnum(OfferingPriceType)
  priceType?: OfferingPriceType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  duration?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  availabilityNote?: string;

  @ApiProperty({ required: false, type: [OfferingImageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => OfferingImageDto)
  images?: OfferingImageDto[];

  // Keyed by CategoryAttribute id — { [attributeId]: rawValue }. Validated
  // server-side against the service's category attributes (spec §25-26);
  // never trusted as-is.
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  attributeValues?: Record<string, unknown>;
}
