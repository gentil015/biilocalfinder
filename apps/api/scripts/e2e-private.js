require('dotenv').config({ path: __dirname + '/../.env' });
const base = 'http://localhost:4000/api';
const email = `neonprov-${Date.now()}@example.com`;
const phone = '+25078' + String(Date.now()).slice(-7);
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
const endpoint = process.env.S3_ENDPOINT;

const results = [];
const check = (label, ok, detail) => { results.push({ label, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${detail ? ' | ' + detail : ''}`); };

async function j(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } }

(async () => {
  // ---- provider signup (creates workspace + provider profile) ----
  let r = await fetch(base + '/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Str0ngPass!xyz', role: 'PROVIDER', firstName: 'Neon', lastName: 'Provider', phone }),
  });
  const reg = await j(r);
  check('PROVIDER register', r.status === 201 || r.status === 200, `status ${r.status}`);

  r = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Str0ngPass!xyz' }),
  });
  const login = await j(r);
  const token = login && login.accessToken;
  check('provider login', r.status === 201 || r.status === 200, `status ${r.status} token=${!!token}`);
  if (!token) { console.log(JSON.stringify(login).slice(0, 300)); process.exit(1); }

  // ---- upload a sensitive document (uploadPrivate -> documents bucket) ----
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'id-doc.png');
  r = await fetch(base + '/provider/verification/documents', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  const doc = await j(r);
  check('upload document (uploadPrivate)', r.status === 201 || r.status === 200, `status ${r.status} key=${doc && doc.storageKey}`);
  if (!doc || !doc.storageKey) { console.log(JSON.stringify(doc).slice(0, 300)); process.exit(1); }
  const key = doc.storageKey;

  // ---- object really lives in the PRIVATE bucket, and is NOT public ----
  const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const s3 = new S3Client({
    endpoint, region: process.env.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  });
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: 'documents', Key: key }));
    check('HEAD documents/<key> (credentialed)', true, `size ${head.ContentLength}`);
  } catch (e) {
    check('HEAD documents/<key> (credentialed)', false, `${e.name} ${e.$metadata && e.$metadata.httpStatusCode}`);
  }
  r = await fetch(`${endpoint}/documents/${key}`);
  check('anonymous GET documents/<key> denied', r.status === 403 || r.status === 401, `status ${r.status} (private enforced)`);
  r = await fetch(`${endpoint}/assets/${key}`);
  check('key absent from public bucket', r.status !== 200, `status ${r.status}`);

  // ---- submit the verification record (persists the storage keys) ----
  r = await fetch(base + '/provider/verification', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ type: 'IDENTITY', legalName: 'Neon Provider', documents: [{ storageKey: key, documentType: 'NATIONAL_ID' }] }),
  });
  const sub = await j(r);
  check('submit verification record', r.status === 201 || r.status === 200, `status ${r.status} id=${sub && sub.id}`);
  const recordId = sub && sub.id;

  // ---- admin reads it back: presigned URL must actually return the bytes ----
  r = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@biilocalfinder.dev', password: 'ChangeMe123!' }),
  });
  const admin = await j(r);
  const adminToken = admin && admin.accessToken;
  check('admin login (seeded)', r.status === 201 || r.status === 200, `status ${r.status} token=${!!adminToken}`);
  if (!adminToken) { console.log(JSON.stringify(admin).slice(0, 300)); process.exit(1); }

  if (recordId) {
    r = await fetch(base + `/admin/verifications/${recordId}`, { headers: { Authorization: 'Bearer ' + adminToken } });
    const rec = await j(r);
    const presigned = rec && rec.documents && rec.documents[0] && rec.documents[0].url;
    check('admin view verification (getForReview)', r.status === 200, `status ${r.status} presigned=${!!presigned}`);
    if (presigned) {
      r = await fetch(presigned);
      const bytes = r.status === 200 ? (await r.arrayBuffer()).byteLength : 0;
      check('presigned GET returns object', r.status === 200 && bytes === png.length, `status ${r.status} bytes=${bytes}/${png.length}`);
      // strip the signature: same object, unsigned -> must be denied
      const unsigned = presigned.split('?')[0];
      r = await fetch(unsigned);
      check('unsigned GET of same object denied', r.status === 403 || r.status === 401, `status ${r.status}`);
    }
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT FAIL', e.message); process.exit(1); });
