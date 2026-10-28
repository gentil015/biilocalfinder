import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MAX_UPLOAD_BYTES } from '../files/storage.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { WorkspaceScoped } from '../common/workspace/workspace-scoped.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ProposeRevisionDto } from './dto/propose-revision.dto';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@WorkspaceScoped()
@Controller()
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @RequireWorkspacePermission('quotes.manage')
  @Post('quotes')
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user.id, dto);
  }

  @ApiConsumes('multipart/form-data')
  @RequireWorkspacePermission('quotes.manage')
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  @Post('quotes/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadAttachment(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    return this.quotesService.uploadAttachment(user.id, file);
  }

  @Get('service-requests/:requestId/quotes')
  findForRequest(@CurrentUser() user: { id: string }, @Param('requestId') requestId: string) {
    return this.quotesService.findForRequest(requestId, user.id);
  }

  @Post('quotes/:id/accept')
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.accept(id, user.id);
  }

  @Post('quotes/:id/reject')
  reject(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.reject(id, user.id);
  }

  @Post('quotes/:id/revisions')
  proposeRevision(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ProposeRevisionDto,
  ) {
    return this.quotesService.proposeRevision(id, user.id, dto);
  }

  @Post('quote-revisions/:id/accept')
  acceptRevision(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.respondToRevision(id, user.id, 'accept');
  }

  @Post('quote-revisions/:id/reject')
  rejectRevision(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.respondToRevision(id, user.id, 'reject');
  }
}
