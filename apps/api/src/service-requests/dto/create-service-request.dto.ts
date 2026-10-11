import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateServiceRequestDto {
  @ApiProperty()
  @IsUUID()
  serviceId: string;

  @ApiProperty({ required: false, description: 'Target a specific provider, or omit to broadcast to the marketplace' })
  @IsOptional()
  @IsUUID()
  providerId?: string;

  @ApiProperty({
    required: false,
    description:
      'Only meaningful on a direct (providerId) request: true opens it to the marketplace so other matching providers can also quote (the pinned provider stays primary). Omit or false to keep it private. Ignored on broadcast requests, which are public by definition.',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @ApiProperty({ required: false, example: '14:00' })
  @IsOptional()
  @IsString()
  preferredTime?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @ApiProperty({ required: false, description: 'A specific offering the client picked (e.g. from a provider profile) — pins the exact provider+service' })
  @IsOptional()
  @IsUUID()
  serviceOfferingId?: string;

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Category-specific answers relevant to this request, keyed by attribute id (spec §20) — e.g. { [guestCapacityAttrId]: 300 }',
  })
  @IsOptional()
  attributeValues?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ required: false, type: [String], description: 'Storage keys/URLs of already-uploaded images' })
  @IsOptional()
  images?: string[];
}
