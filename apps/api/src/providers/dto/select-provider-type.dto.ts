import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProviderType } from '@prisma/client';

export class SelectProviderTypeDto {
  @ApiProperty({ enum: ProviderType })
  @IsEnum(ProviderType, { message: 'providerType must be one of INDIVIDUAL, TEAM, BUSINESS, AGENCY' })
  providerType: ProviderType;
}
