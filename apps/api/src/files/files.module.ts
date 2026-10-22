import { Logger, Module } from '@nestjs/common';
import * as net from 'net';
import { FilesController } from './files.controller';
import { LocalFilesController } from './local-files.controller';
import { S3StorageService } from './s3-storage.service';
import { LocalStorageService } from './local-storage.service';
import { STORAGE_SERVICE, StorageService } from './storage.interface';

const logger = new Logger('StorageService');

/**
 * One quick TCP probe of the configured S3/MinIO endpoint. Deliberately a
 * short timeout: this only decides which backend to bind at boot, it is not a
 * health check, and a dev boot must not hang waiting on a service that isn't
 * there.
 */
function endpointReachable(rawUrl: string, timeoutMs = Number(process.env.S3_PROBE_TIMEOUT_MS ?? 800)): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return resolve(false);
    }
    const host = url.hostname;
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    const socket = net.connect({ host, port });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * Picks the storage backend, following the same "real provider when
 * configured, offline fallback otherwise" pattern as LocationsModule's
 * MAP_PROVIDER factory.
 *
 * `STORAGE_DRIVER=local|s3` forces a choice; left unset, it auto-detects by
 * probing `S3_ENDPOINT`, so a developer running without MinIO still gets a
 * fully working upload flow instead of 500s.
 */
async function selectStorageDriver(): Promise<'s3' | 'local'> {
  const forced = process.env.STORAGE_DRIVER;
  if (forced === 'local') return 'local';
  if (forced === 's3') return 's3';

  const endpoint = process.env.S3_ENDPOINT;
  if (!endpoint) return 'local';
  return (await endpointReachable(endpoint)) ? 's3' : 'local';
}

@Module({
  controllers: [FilesController, LocalFilesController],
  providers: [
    S3StorageService,
    LocalStorageService,
    {
      provide: STORAGE_SERVICE,
      useFactory: async (s3: S3StorageService, local: LocalStorageService): Promise<StorageService> => {
        const driver = await selectStorageDriver();
        if (driver === 's3') {
          logger.log(`File storage: S3-compatible backend at ${process.env.S3_ENDPOINT}`);
          return s3;
        }
        // In production there is no durable local disk: silently falling back
        // would accept uploads and then lose them on the next deploy/restart.
        // Fail the boot loudly instead so the misconfiguration is obvious.
        if (process.env.NODE_ENV === 'production' && process.env.STORAGE_DRIVER !== 'local') {
          throw new Error(
            process.env.S3_ENDPOINT
              ? `File storage: S3 endpoint ${process.env.S3_ENDPOINT} unreachable and NODE_ENV=production — refusing to fall back to local disk`
              : 'File storage: S3_ENDPOINT is not set and NODE_ENV=production — refusing to fall back to local disk',
          );
        }
        logger.warn(
          process.env.S3_ENDPOINT
            ? `File storage: ${process.env.S3_ENDPOINT} unreachable — falling back to local disk (STORAGE_DRIVER=local)`
            : 'File storage: no S3_ENDPOINT configured — using local disk (STORAGE_DRIVER=local)',
        );
        return local;
      },
      inject: [S3StorageService, LocalStorageService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class FilesModule {}
