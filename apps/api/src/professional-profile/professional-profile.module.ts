import { Module } from '@nestjs/common';
import { ProfessionalProfileController } from './professional-profile.controller';
import { ProfessionalProfileService } from './professional-profile.service';

@Module({
  controllers: [ProfessionalProfileController],
  providers: [ProfessionalProfileService],
})
export class ProfessionalProfileModule {}
