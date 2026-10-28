import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspace-invitations')
@Controller('workspace-invitations')
export class WorkspaceInvitationsController {
  constructor(private workspacesService: WorkspacesService) {}

  @Get(':token')
  preview(@Param('token') token: string) {
    return this.workspacesService.getInvitation(token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.workspacesService.acceptInvitationToken(token, user.id);
  }
}
