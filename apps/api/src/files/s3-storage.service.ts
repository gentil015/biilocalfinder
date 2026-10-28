import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as path from 'path';
import { StorageService, UploadedFileResult } from './storage.interface';

@Injectable()
export class S3StorageService implements StorageService {
  private s3: S3Client;
  // Public bucket: anonymous reads are allowed by the bucket's access level,
  // so getUrl() can hand out a permanent URL (some of these are persisted in
  // Postgres — a presigned URL would expire in the database).
  private bucket = process.env.S3_BUCKET ?? 'bii-localfinder';
  // Private bucket: credential required for every operation. Verification
  // documents and dispute evidence live here and are only ever reached
  // through getSignedUrl().
  private privateBucket = process.env.S3_PRIVATE_BUCKET ?? process.env.S3_BUCKET ?? 'bii-localfinder';

  constructor() {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.S3_PRIVATE_BUCKET) {
        throw new Error(
          'S3_PRIVATE_BUCKET must be set in production; identity and dispute files cannot share the public bucket',
        );
      }
      if (process.env.S3_PRIVATE_BUCKET === this.bucket) {
        throw new Error('S3_PRIVATE_BUCKET must differ from S3_BUCKET in production');
      }
    }
    this.s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? '',
        secretAccessKey: process.env.S3_SECRET_KEY ?? '',
      },
    });
  }

  /**
   * Which of the two buckets actually holds `key`, plus its metadata.
   *
   * Callers pass keys from both paths without saying which bucket they used
   * (review photos are public, verification documents are not), so the key
   * itself decides: probe the public bucket, then the private one.
   */
  private async headIn(key: string): Promise<{ bucket: string; head: HeadObjectCommandOutput } | null> {
    for (const bucket of [this.bucket, this.privateBucket]) {
      try {
        const head = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { bucket, head };
      } catch (err: any) {
        const status = err?.$metadata?.httpStatusCode;
        // Missing in this bucket: keep looking. Anything else (bad
        // credentials, unreachable endpoint) is a real failure — surface it.
        if (err?.name === 'NotFound' || status === 404 || status === 403) continue;
        throw err;
      }
    }
    return null;
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string, prefix: string): Promise<UploadedFileResult> {
    // The original filename is only used for its extension — never trusted
    // as a path or stored as-is (spec §20: "Never trust the client-provided
    // filename").
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '') || '';
    const key = `${prefix}/${crypto.randomUUID()}${ext}`;

    // No ACL header: the bucket's access level (public_read) decides, and
    // Neon's S3 endpoint rejects ACL headers outright (NotImplemented).
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }));

    return { key, url: this.getUrl(key) };
  }

  async uploadPrivate(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    prefix: string,
  ): Promise<{ key: string }> {
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '') || '';
    const key = `${prefix}/${crypto.randomUUID()}${ext}`;
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.privateBucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
    return { key };
  }

  async statObject(key: string): Promise<{ sizeBytes: number; mimeType: string } | null> {
    const found = await this.headIn(key);
    if (!found) return null;
    return {
      sizeBytes: Number(found.head.ContentLength ?? 0),
      mimeType: found.head.ContentType ?? 'application/octet-stream',
    };
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    // Sign against the bucket that actually holds the object; presigning is
    // what makes a private object reachable without exposing credentials.
    const found = await this.headIn(key);
    const bucket = found ? found.bucket : this.privateBucket;
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    const found = await this.headIn(key);
    await this.s3.send(new DeleteObjectCommand({ Bucket: found ? found.bucket : this.bucket, Key: key }));
  }

  getUrl(key: string): string {
    const endpoint = (process.env.S3_ENDPOINT ?? '').replace(/\/$/, '');
    return process.env.S3_FORCE_PATH_STYLE === 'true'
      ? `${endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
