import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class StartConversationDto {
  @ApiProperty({ description: 'Provider the client wants to talk to.' })
  @IsUUID()
  providerId: string;

  @ApiPropertyOptional({
    description:
      'Optional opening message. When omitted an empty thread is created so the provider can be notified without pushing a message the client did not write.',
    minLength: 1,
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string;
}