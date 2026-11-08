import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const MAX_MESSAGE_ATTACHMENTS = 5;

export class MessageAttachmentRefDto {
  @ApiProperty({ description: 'storageKey returned by POST /conversations/:id/attachments' })
  @IsString()
  @MaxLength(300)
  storageKey: string;
}

export class SendMessageDto {
  @ApiPropertyOptional({
    description: 'Message text. Optional when at least one attachment is included.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;

  @ApiPropertyOptional({ type: [MessageAttachmentRefDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_MESSAGE_ATTACHMENTS)
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentRefDto)
  attachments?: MessageAttachmentRefDto[];
}
