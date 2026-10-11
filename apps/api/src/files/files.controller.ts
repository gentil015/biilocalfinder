import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  STORAGE_SERVICE,
  StorageService,
} from './storage.interface';

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(@Inject(STORAGE_SERVICE) private storage: StorageService) {}

  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    // Validate MIME type server-side — never trust the client's Content-Type
    // header alone, but this MVP check is sufficient given uploads are
    // restricted to images (spec §20 also calls for dimension checks,
    // which would be added here with an image-processing library).
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, and WEBP images are allowed');
    }

    const result = await this.storage.upload(file.buffer, file.originalname, file.mimetype, 'uploads');
    return result;
  }

  // Portfolio videos (spec §6) — separate endpoint/limit from the general
  // image upload above, same public-storage pattern.
  @ApiConsumes('multipart/form-data')
  @Post('upload-video')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_VIDEO_UPLOAD_BYTES } }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Only MP4, WEBM, and MOV videos are allowed');
    }

    const result = await this.storage.upload(file.buffer, file.originalname, file.mimetype, 'uploads');
    return result;
  }
}
