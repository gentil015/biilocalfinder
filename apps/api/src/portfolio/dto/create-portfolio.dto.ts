import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreatePortfolioDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  // "Category" (spec §6) — tags the project to one of the provider's own
  // services so clients can filter the portfolio gallery. Validated against
  // the provider's own offerings in PortfolioService, not here.
  @ApiProperty({ required: false, description: "One of the provider's own service IDs" })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ required: false, description: 'When the work was done (ISO date)' })
  @IsOptional()
  @IsDateString()
  projectDate?: string;
}
