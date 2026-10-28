import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireWorkspacePermission } from '../common/workspace/require-workspace-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MAX_UPLOAD_BYTES } from '../files/storage.interface';
import { VerificationService } from './verification.service';
import { ContactVerificationService } from './contact-verification.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import {
  ApproveVerificationDto,
  ReinstateVerificationDto,
  VerificationQueueQueryDto,
  VerificationReasonDto,
} from './dto/admin-verification.dto';
import { ConfirmContactCodeDto, RequestContactCodeDto } from './dto/contact-verification.dto';

// ---- Provider: submit documents, see status ----

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireWorkspacePermission('verification.manage')
@Controller('provider/verification')
export class ProviderVerificationController {
  constructor(private verification: VerificationService) {}

  @Get()
  myStatus(@CurrentUser() user: { id: string }) {
    return this.verification.myStatus(user.id);
  }

  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { limit: 20, ttl: 60 * 60 * 1000 } })
  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadDocument(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    return this.verification.uploadDocument(user.id, file);
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @Post()
  submit(@CurrentUser() user: { id: string }, @Body() dto: SubmitVerificationDto) {
    return this.verification.submit(user.id, dto);
  }
}

// ---- Any signed-in user: prove ownership of email / phone ----

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('verification/contact')
export class ContactVerificationController {
  constructor(private contact: ContactVerificationService) {}

  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @Post('request')
  request(@CurrentUser() user: { id: string }, @Body() dto: RequestContactCodeDto) {
    return this.contact.request(user.id, dto.channel);
  }

  @Throttle({ default: { limit: 10, ttl: 60 * 1000 } })
  @Post('confirm')
  confirm(@CurrentUser() user: { id: string }, @Body() dto: ConfirmContactCodeDto) {
    return this.contact.confirm(user.id, dto.channel, dto.code);
  }
}

// ---- Admin: the review queue ----

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/verifications')
export class AdminVerificationController {
  constructor(private verification: VerificationService) {}

  @Get()
  queue(@Query() query: VerificationQueueQueryDto) {
    return this.verification.queue(query);
  }

  @Post('sweep')
  sweep() {
    return this.verification.sweepExpired();
  }

  @Get(':id')
  getOne(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.verification.getForReview(id, admin.id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveVerificationDto) {
    return this.verification.approve(id, admin.id, dto);
  }

  @Post(':id/reject')
  reject(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerificationReasonDto) {
    return this.verification.reject(id, admin.id, dto);
  }

  @Post(':id/suspend')
  suspend(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VerificationReasonDto) {
    return this.verification.suspend(id, admin.id, dto);
  }

  @Post(':id/reinstate')
  reinstate(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReinstateVerificationDto) {
    return this.verification.reinstate(id, admin.id, dto);
  }
}
