import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { OfferingPriceType } from '@prisma/client';

export class CreateOfferingDto {
  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
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
  duration?: string;

  // Keyed by CategoryAttribute id — { [attributeId]: rawValue }. Validated
  // server-side against the service's category attributes (spec §25-26);
  // never trusted as-is.
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  attributeValues?: Record<string, unknown>;
}
