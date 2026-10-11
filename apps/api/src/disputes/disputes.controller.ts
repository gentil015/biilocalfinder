import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MAX_UPLOAD_BYTES } from '../files/storage.interface';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { AddDisputeMessageDto } from './dto/add-message.dto';
import { AddDisputeEvidenceDto } from './dto/add-evidence.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

@ApiTags('disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Roles('CLIENT', 'PROVIDER')
  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(user.id, dto);
  }

  @Roles('CLIENT', 'PROVIDER')
  @Get('mine')
  findMine(@CurrentUser() user: { id: string }) {
    return this.disputesService.findMine(user.id);
  }

  @Roles('CLIENT', 'PROVIDER', 'ADMIN')
  @Get(':id')
  findOne(@CurrentUser() user: { id: string; role: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.disputesService.findOne(id, user.id, user.role === 'ADMIN');
  }

  @Roles('CLIENT', 'PROVIDER', 'ADMIN')
  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: { id: string; role: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddDisputeMessageDto,
  ) {
    return this.disputesService.addMessage(id, user.id, user.role === 'ADMIN', dto);
  }

  @ApiConsumes('multipart/form-data')
  @Roles('CLIENT', 'PROVIDER', 'ADMIN')
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  addEvidence(
    @CurrentUser() user: { id: string; role: string },
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddDisputeEvidenceDto,
  ) {
    return this.disputesService.addEvidence(id, user.id, user.role === 'ADMIN', file, dto);
  }

  // ---- Admin ----

  @Roles('ADMIN')
  @Get()
  findAll(@Query('status') status?: string, @Query('page') page?: string) {
    return this.disputesService.findAllForAdmin(status, Number(page) || 1);
  }

  @Roles('ADMIN')
  @Patch(':id/review')
  review(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.disputesService.review(id, admin.id);
  }

  @Roles('ADMIN')
  @Patch(':id/resolve')
  resolve(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDisputeDto) {
    return this.disputesService.resolve(id, admin.id, dto);
  }
}
