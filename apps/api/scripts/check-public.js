require('dotenv').config({ path: __dirname + '/../.env' });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});
const key = 'access-check/' + Date.now() + '.txt';
s3.send(new PutObjectCommand({ Bucket: 'assets', Key: key, Body: 'public-check', ContentType: 'text/plain' }))
  .then(async () => {
    const r = await fetch(process.env.S3_ENDPOINT + '/assets/' + key);
    console.log('anonymous GET assets/' + key + ' =>', r.status);
    process.exit(r.status === 200 ? 0 : 1);
  })
  .catch((e) => { console.log('ERR', e.name, e.message); process.exit(1); });
