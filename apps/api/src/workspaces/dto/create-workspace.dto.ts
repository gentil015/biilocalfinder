import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { ProviderType } from '@prisma/client';

export class CreateWorkspaceDto {
  @ApiProperty({ enum: ProviderType })
  @IsEnum(ProviderType)
  type: ProviderType;

  @ApiProperty({ description: 'Public-facing name — becomes the provider profile\'s business name too' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;
}
