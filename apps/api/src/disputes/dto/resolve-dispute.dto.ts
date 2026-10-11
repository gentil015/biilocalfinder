import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DisputeResolutionType } from '@prisma/client';

export class ResolveDisputeDto {
  @ApiProperty({ description: 'true resolves the dispute, false rejects it (e.g. unsubstantiated)' })
  @IsEnum(['RESOLVED', 'REJECTED'])
  outcome: 'RESOLVED' | 'REJECTED';

  @ApiProperty({ enum: DisputeResolutionType })
  @IsEnum(DisputeResolutionType)
  resolutionType: DisputeResolutionType;

  @ApiPropertyOptional({ description: 'Shown to both participants' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  resolution?: string;
}
