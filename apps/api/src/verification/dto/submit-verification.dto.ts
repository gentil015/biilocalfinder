import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { VerificationDocumentType, VerificationType } from '@prisma/client';
import { MAX_DOCUMENTS_PER_SUBMISSION } from '../verification.constants';

export class DocumentRefDto {
  @ApiProperty({ description: 'storageKey returned by POST /provider/verification/documents' })
  @IsString()
  @MaxLength(300)
  storageKey: string;

  @ApiProperty({ enum: VerificationDocumentType })
  @IsEnum(VerificationDocumentType)
  documentType: VerificationDocumentType;
}

export class SubmitVerificationDto {
  @ApiProperty({ enum: VerificationType })
  @IsEnum(VerificationType)
  type: VerificationType;

  @ApiPropertyOptional({ description: 'Required when type = SERVICE' })
  @IsOptional()
  @IsUUID()
  serviceOfferingId?: string;

  @ApiPropertyOptional({ description: 'Name exactly as on the document / registration' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @ApiPropertyOptional({ description: 'Business registration or licence number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiProperty({ type: [DocumentRefDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_DOCUMENTS_PER_SUBMISSION)
  @ValidateNested({ each: true })
  @Type(() => DocumentRefDto)
  documents: DocumentRefDto[];
}
