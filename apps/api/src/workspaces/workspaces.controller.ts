import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceMembershipGuard } from '../common/guards/workspace-membership.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

// Every route here requires a logged-in user; per-workspace routes
// additionally require WorkspaceMembershipGuard, which re-derives
// membership and role from the database — never from anything the
// frontend sends (spec §8).
@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private workspacesService: WorkspacesService) {}

  // The workspace switcher's data source: every workspace this user can
  // currently access, owned or not.
  @Get()
  listMine(@CurrentUser() user: { id: string }) {
    return this.workspacesService.listMine(user.id);
  }

  // Creates an additional, independently owned workspace (spec §1) — the
  // user's first workspace is still created via registration/onboarding,
  // not this endpoint; see WorkspacesService.create's doc comment.
  @Post()
  create(@Body() dto: CreateWorkspaceDto, @CurrentUser() user: { id: string }) {
    return this.workspacesService.create(user.id, dto);
  }

  @UseGuards(WorkspaceMembershipGuard)
  @Get(':workspaceId')
  getContext(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getContext(workspaceId);
  }

  @UseGuards(WorkspaceMembershipGuard)
  @WorkspaceRoles('OWNER', 'MANAGER')
  @Patch(':workspaceId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspacesService.update(workspaceId, dto, user.id);
  }

  @UseGuards(WorkspaceMembershipGuard)
  @Get(':workspaceId/members')
  listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.listMembers(workspaceId);
  }

  @UseGuards(WorkspaceMembershipGuard)
  @WorkspaceRoles('OWNER', 'MANAGER')
  @Post(':workspaceId/members')
  inviteMember(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspacesService.inviteMember(workspaceId, dto, user.id);
  }

  // Deliberately NOT behind WorkspaceMembershipGuard: the invitee's
  // membership is still INVITED (not ACTIVE) until this call succeeds, so
  // that guard would reject them before they could ever accept.
  @Post(':workspaceId/members/:membershipId/accept')
  acceptInvite(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspacesService.acceptInvite(workspaceId, membershipId, user.id);
  }

  // Role changes are OWNER-only (spec §3: "Do not give every team member
  // owner permissions") — a MANAGER can invite/remove but not promote.
  @UseGuards(WorkspaceMembershipGuard)
  @WorkspaceRoles('OWNER')
  @Patch(':workspaceId/members/:membershipId')
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, membershipId, dto, user.id);
  }

  @UseGuards(WorkspaceMembershipGuard)
  @WorkspaceRoles('OWNER', 'MANAGER')
  @Delete(':workspaceId/members/:membershipId')
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.workspacesService.removeMember(workspaceId, membershipId, user.id);
  }
}
