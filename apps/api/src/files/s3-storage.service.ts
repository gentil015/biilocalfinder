import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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
  private bucket = process.env.S3_BUCKET ?? 'bii-localfinder';

  constructor() {
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

  async upload(buffer: Buffer, originalName: string, mimeType: string, prefix: string): Promise<UploadedFileResult> {
    // The original filename is only used for its extension — never trusted
    // as a path or stored as-is (spec §20: "Never trust the client-provided
    // filename").
    const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '') || '';
    const key = `${prefix}/${crypto.randomUUID()}${ext}`;

    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType, ACL: 'public-read' }),
    );

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
    // Deliberately no ACL: the object inherits the bucket's default, which
    // MUST be private (block public access) — see docs/DEPLOYMENT.md.
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }));
    return { key };
  }

  async statObject(key: string): Promise<{ sizeBytes: number; mimeType: string } | null> {
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: Number(head.ContentLength ?? 0), mimeType: head.ContentType ?? 'application/octet-stream' };
    } catch (err: any) {
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getUrl(key: string): string {
    const endpoint = (process.env.S3_ENDPOINT ?? '').replace(/\/$/, '');
    return process.env.S3_FORCE_PATH_STYLE === 'true'
      ? `${endpoint}/${this.bucket}/${key}`
      : `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
