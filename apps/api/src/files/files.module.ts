import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { S3StorageService } from './s3-storage.service';
import { STORAGE_SERVICE } from './storage.interface';

@Module({
  controllers: [FilesController],
  providers: [{ provide: STORAGE_SERVICE, useClass: S3StorageService }],
  exports: [STORAGE_SERVICE],
})
export class FilesModule {}
