import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveReportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  resolution?: string;

  @ApiPropertyOptional({ description: 'True to dismiss (no action taken) rather than mark as actioned' })
  @IsOptional()
  @IsBoolean()
  dismiss?: boolean;
}
