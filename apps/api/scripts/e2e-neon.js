const fs = require('fs');
const base = 'http://localhost:4000/api';
const email = `neontest-${Date.now()}@example.com`;

async function j(res) { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } }

(async () => {
  // 1) Register (DB write on Neon)
  let r = await fetch(base + '/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Str0ngPass!xyz', role: 'CLIENT', firstName: 'Neon', lastName: 'Test', phone: '+250788' + String(Date.now()).slice(-7) }),
  });
  const reg = await j(r);
  console.log('register:', r.status);

  // 2) Login (DB read + bcrypt verify)
  r = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Str0ngPass!xyz' }),
  });
  const login = await j(r);
  console.log('login:', r.status);
  const token = login && (login.accessToken || login.access_token || (login.tokens && login.tokens.accessToken));
  if (!token) { console.log('NO TOKEN', JSON.stringify(login).slice(0, 300)); process.exit(1); }

  // 3) /users/me (DB read via Prisma)
  r = await fetch(base + '/users/me', { headers: { Authorization: 'Bearer ' + token } });
  const me = await j(r);
  console.log('users/me:', r.status, '| email:', me && (me.email || (me.user && me.user.email)));

  // 4) Upload a small PNG to Neon Object Storage
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'neon-test.png');
  r = await fetch(base + '/files/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
  const up = await j(r);
  console.log('upload:', r.status, '|', JSON.stringify(up).slice(0, 300));
  if (r.status !== 201 && r.status !== 200) { console.log('UPLOAD FAILED'); process.exit(1); }

  // 5) Read the object back over HTTPS from the bucket
  const key = up.key || (up.url && up.url.split('/assets/')[1]);
  const getUrl = `https://br-odd-butterfly-b43yk9wy.storage.c-6.us-east-2.aws.neon.tech/assets/${key}`;
  r = await fetch(getUrl);
  const bytes = r.status === 200 ? (await r.arrayBuffer()).byteLength : 0;
  console.log('fetch stored object:', r.status, '| bytes:', bytes);
  process.exit(r.status === 200 && bytes === png.length ? 0 : 1);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
