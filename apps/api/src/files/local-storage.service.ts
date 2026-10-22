import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { StorageService, UploadedFileResult } from './storage.interface';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

/**
 * On-disk implementation of StorageService — the offline fallback used when no
 * S3-compatible backend (MinIO, real S3) is reachable.
 *
 * Same contract and same callers as S3StorageService: swapping between them is
 * a provider rebind in FilesModule, nothing else changes. Public objects live
 * under `<root>/public`, private ones under `<root>/private` (the split is what
 * stands in for S3's public-read ACL vs. bucket-default). Private objects are
 * only ever served via a signed, expiring URL — the HMAC mirrors a pre-signed
 * S3 GET so verification documents keep the same guarantee in local dev.
 *
 * This exists so the whole app works with zero configuration — matching the
 * other pluggable providers in this repo (MockMapProvider, MockPaymentProvider,
 * MockAssistProvider) — rather than 500ing on every upload until MinIO is up.
 */
@Injectable()
export class LocalStorageService implements StorageService {
  private readonly root =
    process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), '.local-storage');
  private readonly publicDir = path.join(this.root, 'public');
  private readonly privateDir = path.join(this.root, 'private');
  private readonly secret =
    process.env.LOCAL_STORAGE_SECRET ?? process.env.JWT_SECRET ?? 'local-storage-dev-secret';
  private readonly baseUrl = (
    process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`
  ).replace(/\/$/, '');

  constructor() {
    try {
      fs.mkdirSync(this.publicDir, { recursive: true });
      fs.mkdirSync(this.privateDir, { recursive: true });
    } catch {
      // In serverless environments, fall back to /tmp if cwd is not writable
      const tmpRoot = path.join('/tmp', '.local-storage');
      (this as any).root = tmpRoot;
      (this as any).publicDir = path.join(tmpRoot, 'public');
      (this as any).privateDir = path.join(tmpRoot, 'private');
      fs.mkdirSync((this as any).publicDir, { recursive: true });
      fs.mkdirSync((this as any).privateDir, { recursive: true });
    }
  }

  async upload(buffer: Buffer, originalName: string, _mimeType: string, prefix: string): Promise<UploadedFileResult> {
    const key = this.buildKey(prefix, originalName);
    const full = this.safeJoin(this.publicDir, key);
    if (!full) throw new Error('Invalid storage key');
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, buffer);
    return { key, url: this.getUrl(key) };
  }

  async uploadPrivate(
    buffer: Buffer,
    originalName: string,
    _mimeType: string,
    prefix: string,
  ): Promise<{ key: string }> {
    const key = this.buildKey(prefix, originalName);
    const full = this.safeJoin(this.privateDir, key);
    if (!full) throw new Error('Invalid storage key');
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, buffer);
    return { key };
  }

  async statObject(key: string): Promise<{ sizeBytes: number; mimeType: string } | null> {
    const full = this.resolvePrivate(key) ?? this.resolvePublic(key);
    if (!full) return null;
    const stat = await fsp.stat(full);
    return {
      sizeBytes: stat.size,
      mimeType: MIME_BY_EXT[path.extname(full).toLowerCase()] ?? 'application/octet-stream',
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const sig = this.sign(key, expires);
    return `${this.baseUrl}/api/files/local?key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    for (const full of [this.safeJoin(this.privateDir, key), this.safeJoin(this.publicDir, key)]) {
      if (!full) continue;
      await fsp.rm(full, { force: true });
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/api/files/local?key=${encodeURIComponent(key)}`;
  }

  /** Absolute path of a public object on disk, or null if it isn't there. */
  resolvePublic(key: string): string | null {
    const full = this.safeJoin(this.publicDir, key);
    return full && fs.existsSync(full) ? full : null;
  }

  /** Absolute path of a private object on disk, or null if it isn't there. */
  resolvePrivate(key: string): string | null {
    const full = this.safeJoin(this.privateDir, key);
    return full && fs.existsSync(full) ? full : null;
  }

  /** Validates the HMAC + expiry an object's signed URL carries. */
  verifySignature(key: string, expires: string | undefined, sig: string | undefined): boolean {
    if (!expires || !sig) return false;
    const expiresAt = Number(expires);
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(key, expiresAt);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  mimeFor(file: string): string {
    return MIME_BY_EXT[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  }

  private buildKey(prefix: string, originalName: string): string {
    // The original filename is only ever used for its extension — same rule as
    // S3StorageService (spec §20: never trust a client-provided filename).
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '') || '';
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '') || 'uploads';
    return `${cleanPrefix}/${crypto.randomUUID()}${ext}`;
  }

  private sign(key: string, expires: number): string {
    return crypto.createHmac('sha256', this.secret).update(`${key}:${expires}`).digest('hex');
  }

  private safeJoin(baseDir: string, key: string): string | null {
    const full = path.resolve(baseDir, key);
    const base = path.resolve(baseDir);
    return full === base || full.startsWith(base + path.sep) ? full : null;
  }
}
