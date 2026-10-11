import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BeforeAfterRole, PortfolioMediaType } from '@prisma/client';

export class AddPortfolioImageDto {
  @ApiProperty({ description: 'URL returned from POST /files/upload or /files/upload-video' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Storage key returned from POST /files/upload or /files/upload-video' })
  @IsString()
  storageKey: string;

  @ApiProperty({ enum: PortfolioMediaType, required: false, default: 'IMAGE' })
  @IsOptional()
  @IsEnum(PortfolioMediaType)
  mediaType?: PortfolioMediaType;

  // Before/After (spec §6): pass the same beforeAfterGroup on the BEFORE and
  // AFTER upload to pair them. Client generates the group key (e.g. a uuid)
  // when the user starts a before/after pair in the UI.
  @ApiProperty({ enum: BeforeAfterRole, required: false })
  @IsOptional()
  @IsEnum(BeforeAfterRole)
  beforeAfterRole?: BeforeAfterRole;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  beforeAfterGroup?: string;
}
