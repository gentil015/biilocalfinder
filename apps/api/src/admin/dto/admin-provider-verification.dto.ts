import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminVerifyProviderDto {
  @ApiPropertyOptional({ description: 'Internal note recorded with the manual verification' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AdminUnverifyProviderDto {
  @ApiProperty({ description: 'Why the badge is being removed. Shown to the provider.' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}
