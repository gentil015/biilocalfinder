import { Controller, ForbiddenException, Get, NotFoundException, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LocalStorageService } from './local-storage.service';

/**
 * Serves objects written by LocalStorageService.
 *
 * Deliberately NOT behind JwtAuthGuard: public objects (avatars, portfolio
 * photos) are loaded by the browser with a bare `<img src>`, which carries no
 * Authorization header. Private objects are gated by the signed-URL HMAC the
 * service issues instead — the same access model as an S3 pre-signed URL.
 *
 * Only active in the local storage fallback: under S3 resolution returns null
 * for every key and this endpoint 404s (it is never linked to in that mode).
 */
@Controller('files/local')
export class LocalFilesController {
  constructor(private readonly storage: LocalStorageService) {}

  @Get()
  serve(
    @Res() res: Response,
    @Query('key') key?: string,
    @Query('expires') expires?: string,
    @Query('sig') sig?: string,
  ) {
    if (!key) throw new NotFoundException('File not found');

    const publicFile = this.storage.resolvePublic(key);
    if (publicFile) {
      return this.send(res, publicFile);
    }

    const privateFile = this.storage.resolvePrivate(key);
    if (privateFile) {
      if (!this.storage.verifySignature(key, expires, sig)) {
        throw new ForbiddenException('Invalid or expired link');
      }
      return this.send(res, privateFile);
    }

    throw new NotFoundException('File not found');
  }

  private send(res: Response, file: string) {
    res.setHeader('Content-Type', this.storage.mimeFor(file));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    // Helmet sets Cross-Origin-Resource-Policy: same-origin globally, which
    // makes the browser refuse to render these files when the web app runs on
    // a different origin (localhost:3000 -> localhost:4000). The S3/MinIO path
    // serves bytes directly and never had this restriction, so the disk
    // fallback must opt out of it to behave the same.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.sendFile(file);
  }
}
