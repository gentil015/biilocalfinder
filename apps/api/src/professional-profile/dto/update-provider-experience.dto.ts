import { PartialType } from '@nestjs/swagger';
import { CreateProviderExperienceDto } from './create-provider-experience.dto';

export class UpdateProviderExperienceDto extends PartialType(CreateProviderExperienceDto) {}
