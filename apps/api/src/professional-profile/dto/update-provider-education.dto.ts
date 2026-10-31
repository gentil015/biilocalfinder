import { PartialType } from '@nestjs/swagger';
import { CreateProviderEducationDto } from './create-provider-education.dto';

export class UpdateProviderEducationDto extends PartialType(CreateProviderEducationDto) {}
