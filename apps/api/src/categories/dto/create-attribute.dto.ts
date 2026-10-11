import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { AttributeType } from '@prisma/client';

const OPTION_TYPES = ['SELECT', 'MULTI_SELECT'];

export class CreateAttributeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: AttributeType })
  @IsEnum(AttributeType)
  type: AttributeType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  displayOrder?: number;

  // Required for SELECT/MULTI_SELECT, ignored otherwise — enforced in the
  // service layer since it depends on `type` (spec §11: "For BOOLEAN/TEXT:
  // no options are necessary").
  @ApiProperty({ required: false, type: [String] })
  @ValidateIf((o) => OPTION_TYPES.includes(o.type))
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  options?: string[];
}
