import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { MAX_UPLOAD_BYTES } from '../files/storage.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ProposeRevisionDto } from './dto/propose-revision.dto';

@ApiTags('quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class QuotesController {
  constructor(private quotesService: QuotesService) {}

  @Roles('PROVIDER')
  @Post('quotes')
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user.id, dto);
  }

  @ApiConsumes('multipart/form-data')
  @Roles('PROVIDER')
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  @Post('quotes/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadAttachment(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    return this.quotesService.uploadAttachment(user.id, file);
  }

  @Roles('CLIENT', 'PROVIDER')
  @Get('service-requests/:requestId/quotes')
  findForRequest(@CurrentUser() user: { id: string }, @Param('requestId') requestId: string) {
    return this.quotesService.findForRequest(requestId, user.id);
  }

  @Roles('CLIENT')
  @Post('quotes/:id/accept')
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.accept(id, user.id);
  }

  @Roles('CLIENT')
  @Post('quotes/:id/reject')
  reject(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.reject(id, user.id);
  }

  @Roles('CLIENT', 'PROVIDER')
  @Post('quotes/:id/revisions')
  proposeRevision(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ProposeRevisionDto,
  ) {
    return this.quotesService.proposeRevision(id, user.id, dto);
  }

  @Roles('CLIENT', 'PROVIDER')
  @Post('quote-revisions/:id/accept')
  acceptRevision(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.respondToRevision(id, user.id, 'accept');
  }

  @Roles('CLIENT', 'PROVIDER')
  @Post('quote-revisions/:id/reject')
  rejectRevision(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.quotesService.respondToRevision(id, user.id, 'reject');
  }
}
