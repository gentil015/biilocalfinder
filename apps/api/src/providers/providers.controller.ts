import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProvidersService } from './providers.service';
import { UpdateProviderProfileDto } from './dto/update-provider-profile.dto';
import { SetLocationDto } from './dto/set-location.dto';
import { AddServiceAreaDto } from './dto/add-service-area.dto';
import { SelectProviderTypeDto } from './dto/select-provider-type.dto';
import { UpdateOnboardingProfileDto } from './dto/update-onboarding-profile.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';

@ApiTags('providers')
@Controller('providers')
export class ProvidersController {
  constructor(private providersService: ProvidersService) {}

  // Declared before ':id' so 'compare' is never captured as a provider id.
  // Public, like search and the profile page (spec §11).
  @Get('compare')
  compare(@Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) throw new BadRequestException('Pass ids=<id1>,<id2>,...');
    return this.providersService.compare(list);
  }

  // Public provider profile (spec §11) — stays public via
  // OptionalJwtAuthGuard, but records a VIEW_PROVIDER interaction when the
  // viewer happens to be logged in. Richer discovery/search lands in the
  // `search` module (Phase 3); this is the single-provider read.
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getPublicProfile(
    @CurrentUser() user: { id: string } | null,
    @Param('id') id: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    const coords = lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : undefined;
    return this.providersService.getPublicProfile(id, user?.id, coords);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Get('me/profile')
  getMe(@CurrentUser() user: { id: string }) {
    return this.providersService.getByUserId(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Patch('me/profile')
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateProviderProfileDto) {
    return this.providersService.updateProfile(user.id, dto);
  }

  // Service offerings (with category-specific attributes) moved to their
  // own module: POST/GET/PATCH/DELETE /provider/service-offerings.

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Patch('me/location')
  setLocation(@CurrentUser() user: { id: string }, @Body() dto: SetLocationDto) {
    return this.providersService.setLocation(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Post('me/service-areas')
  addServiceArea(@CurrentUser() user: { id: string }, @Body() dto: AddServiceAreaDto) {
    return this.providersService.addServiceArea(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Delete('me/service-areas/:id')
  removeServiceArea(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.providersService.removeServiceArea(user.id, id);
  }

  // ---------- Onboarding ----------
  // Provider Type Selection is step 1 of onboarding; a Provider row
  // already exists from registration (see AuthService.register), so these
  // endpoints update it rather than creating anything.

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Get('me/onboarding')
  getOnboarding(@CurrentUser() user: { id: string }) {
    return this.providersService.getOnboardingState(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Patch('me/onboarding/type')
  selectProviderType(@CurrentUser() user: { id: string }, @Body() dto: SelectProviderTypeDto) {
    return this.providersService.selectProviderType(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Patch('me/onboarding/profile')
  updateOnboardingProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateOnboardingProfileDto) {
    return this.providersService.updateOnboardingProfile(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Post('me/onboarding/complete')
  completeOnboarding(@CurrentUser() user: { id: string }) {
    return this.providersService.completeOnboarding(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Get('me/onboarding/team-members')
  listTeamMembers(@CurrentUser() user: { id: string }) {
    return this.providersService.listTeamMembers(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Post('me/onboarding/team-members')
  addTeamMember(@CurrentUser() user: { id: string }, @Body() dto: AddTeamMemberDto) {
    return this.providersService.addTeamMember(user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @RequireWorkspacePermission('workspace.profile.manage')
  @Delete('me/onboarding/team-members/:id')
  removeTeamMember(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.providersService.removeTeamMember(user.id, id);
  }

}
