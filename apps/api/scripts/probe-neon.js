require('dotenv').config({ path: '/home/gentil/Projects/bii-localfinder/.env' });
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');

async function main() {
  // --- Postgres ---
  const prisma = new PrismaClient();
  const rows = await prisma.$queryRaw`SELECT version() AS v, current_database() AS db, now() AS now`;
  console.log('DB OK:', rows[0].db, '|', rows[0].v.slice(0, 40), '|', rows[0].now);
  await prisma.$disconnect();

  // --- Object storage ---
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_KEY,
    },
  });
  const bucket = process.env.S3_BUCKET;
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log('BUCKET OK:', bucket);

  const key = `probe/neon-${Date.now()}.txt`;
  const body = Buffer.from('hello from neon probe');
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }));
  console.log('PUT OK:', key);

  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const text = await got.Body.transformToString();
  console.log('GET OK, content:', JSON.stringify(text));

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log('DELETE OK');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FAIL:', e.name, '|', e.message, '| status', e.$metadata && e.$metadata.httpStatusCode);
    process.exit(1);
  });
