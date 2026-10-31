import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProfessionalProfileService } from './professional-profile.service';
import { CreateProviderExperienceDto } from './dto/create-provider-experience.dto';
import { UpdateProviderExperienceDto } from './dto/update-provider-experience.dto';
import { CreateProviderEducationDto } from './dto/create-provider-education.dto';
import { UpdateProviderEducationDto } from './dto/update-provider-education.dto';

@ApiTags('professional-profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireWorkspacePermission('workspace.profile.manage')
@Controller('providers/me')
export class ProfessionalProfileController {
  constructor(private service: ProfessionalProfileService) {}

  @Get('experience')
  listExperience(@CurrentUser() user: { id: string }) {
    return this.service.listExperience(user.id);
  }

  @Post('experience')
  createExperience(@CurrentUser() user: { id: string }, @Body() dto: CreateProviderExperienceDto) {
    return this.service.createExperience(user.id, dto);
  }

  @Patch('experience/:id')
  updateExperience(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateProviderExperienceDto,
  ) {
    return this.service.updateExperience(user.id, id, dto);
  }

  @Delete('experience/:id')
  removeExperience(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.removeExperience(user.id, id);
  }

  @Get('education')
  listEducation(@CurrentUser() user: { id: string }) {
    return this.service.listEducation(user.id);
  }

  @Post('education')
  createEducation(@CurrentUser() user: { id: string }, @Body() dto: CreateProviderEducationDto) {
    return this.service.createEducation(user.id, dto);
  }

  @Patch('education/:id')
  updateEducation(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateProviderEducationDto,
  ) {
    return this.service.updateEducation(user.id, id, dto);
  }

  @Delete('education/:id')
  removeEducation(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.removeEducation(user.id, id);
  }
}
