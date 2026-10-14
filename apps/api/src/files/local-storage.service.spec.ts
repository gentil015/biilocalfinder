import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let dir: string;
  let storage: LocalStorageService;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bii-storage-'));
    process.env.LOCAL_STORAGE_DIR = dir;
    process.env.API_PUBLIC_URL = 'http://localhost:4000';
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.LOCAL_STORAGE_SECRET;
    storage = new LocalStorageService();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores a public object and returns a servable URL', async () => {
    const { key, url } = await storage.upload(Buffer.from('hello'), 'photo.JPG', 'image/jpeg', 'uploads');

    expect(key).toMatch(/^uploads\/[0-9a-f-]+\.jpg$/);
    expect(url).toBe(`http://localhost:4000/api/files/local?key=${encodeURIComponent(key)}`);
    expect(storage.resolvePublic(key)).toBeTruthy();
    expect(await storage.statObject(key)).toEqual({ sizeBytes: 5, mimeType: 'image/jpeg' });
  });

  it('keeps private objects out of the public namespace', async () => {
    const { key } = await storage.uploadPrivate(Buffer.from('secret'), 'id.pdf', 'application/pdf', 'verification-docs');

    expect(storage.resolvePublic(key)).toBeNull();
    expect(storage.resolvePrivate(key)).toBeTruthy();
    expect((await storage.statObject(key))?.mimeType).toBe('application/pdf');
  });

  it('signs private URLs and rejects expired or tampered links', async () => {
    const { key } = await storage.uploadPrivate(Buffer.from('secret'), 'id.png', 'image/png', 'docs');
    const signed = await storage.getSignedUrl(key, 60);
    const params = new URLSearchParams(new URL(signed).search);
    const expires = params.get('expires')!;
    const sig = params.get('sig')!;

    expect(storage.verifySignature(key, expires, sig)).toBe(true);
    expect(storage.verifySignature('some/other-key', expires, sig)).toBe(false);
    expect(storage.verifySignature(key, expires, 'deadbeef')).toBe(false);
    expect(storage.verifySignature(key, '1', sig)).toBe(false);
  });

  it('does not let a traversal key escape the storage root', () => {
    expect(storage.resolvePublic('../../etc/passwd')).toBeNull();
    expect(storage.resolvePrivate('../outside.txt')).toBeNull();
  });

  it('deletes objects', async () => {
    const { key } = await storage.upload(Buffer.from('x'), 'a.png', 'image/png', 'uploads');
    await storage.delete(key);
    expect(storage.resolvePublic(key)).toBeNull();
    expect(await storage.statObject(key)).toBeNull();
  });
});
