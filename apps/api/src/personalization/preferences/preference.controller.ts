import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PreferenceService } from './preference.service';
import { UpdatePreferencesDto } from '../dto/update-preferences.dto';

@ApiTags('personalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('personalization/preferences')
export class PreferenceController {
  constructor(private preferenceService: PreferenceService) {}

  @Get()
  get(@CurrentUser() user: { id: string }) {
    return this.preferenceService.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: { id: string }, @Body() dto: UpdatePreferencesDto) {
    return this.preferenceService.update(user.id, dto);
  }
}
