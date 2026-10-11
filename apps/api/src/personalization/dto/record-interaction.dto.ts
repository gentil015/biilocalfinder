import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { InteractionEntityType, InteractionType } from '@prisma/client';

export class RecordInteractionDto {
  @ApiProperty({ enum: InteractionType })
  @IsEnum(InteractionType)
  type: InteractionType;

  @ApiProperty({ enum: InteractionEntityType, required: false })
  @IsOptional()
  @IsEnum(InteractionEntityType)
  entityType?: InteractionEntityType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
