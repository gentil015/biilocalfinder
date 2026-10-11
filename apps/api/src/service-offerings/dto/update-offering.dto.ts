import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateOfferingDto } from './create-offering.dto';

export class UpdateOfferingDto extends PartialType(CreateOfferingDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
