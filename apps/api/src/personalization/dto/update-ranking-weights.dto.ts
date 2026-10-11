import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateRankingWeightsDto {
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) searchRelevance?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) personalInterest?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) distance?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) rating?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) availability?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) @Max(1) providerQuality?: number;
}
