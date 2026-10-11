import {
  BadRequestException,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ALLOWED_IMAGE_MIME_TYPES, MAX_UPLOAD_BYTES } from '../files/storage.interface';
import { sniffMime } from '../verification/file-sniffer';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { HideReviewDto, ListReviewsQueryDto, RespondToReviewDto } from './dto/review-moderation.dto';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  // ---- Client ----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Post('bookings/:id/reviews')
  create(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) bookingId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(bookingId, user.id, dto);
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @Throttle({ default: { limit: 30, ttl: 60 * 60 * 1000 } })
  @Post('reviews/photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async uploadPhoto(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    // Sniff the bytes — the client-declared Content-Type isn't trusted.
    const mime = sniffMime(file.buffer);
    if (!mime || !ALLOWED_IMAGE_MIME_TYPES.includes(mime)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed');
    }
    return this.reviewsService.uploadPhoto(user.id, file.buffer, file.originalname, mime);
  }

  // Booking screen: existing review + whether this user may still leave one.
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'PROVIDER')
  @Get('bookings/:id/review')
  forBooking(@CurrentUser() user: { id: string }, @Param('id', ParseUUIDPipe) bookingId: string) {
    return this.reviewsService.forBooking(bookingId, user.id);
  }

  // ---- Public ----

  @Get('providers/:id/reviews')
  findForProvider(@Param('id', ParseUUIDPipe) providerId: string, @Query() query: ListReviewsQueryDto) {
    return this.reviewsService.findForProvider(providerId, query);
  }

  @Get('providers/:id/reviews/summary')
  summary(@Param('id', ParseUUIDPipe) providerId: string) {
    return this.reviewsService.summaryForProvider(providerId);
  }

  // ---- Provider ----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Get('provider/reviews')
  mine(@CurrentUser() user: { id: string }, @Query() query: ListReviewsQueryDto) {
    return this.reviewsService.findMineAsProvider(user.id, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PROVIDER')
  @Post('reviews/:id/response')
  respond(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) reviewId: string,
    @Body() dto: RespondToReviewDto,
  ) {
    return this.reviewsService.respond(user.id, reviewId, dto);
  }

  // ---- Admin moderation ----

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin/reviews/flagged')
  flagged(@Query('page') page?: string) {
    return this.reviewsService.findFlagged(Number(page) || 1);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/reviews/:id/hide')
  hide(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HideReviewDto) {
    return this.reviewsService.hide(id, admin.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin/reviews/:id/restore')
  restore(@CurrentUser() admin: { id: string }, @Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.restore(id, admin.id);
  }
}
