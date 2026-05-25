/**
 * POST /api/v1/uploads/proof — driver photo-of-delivery upload.
 *
 * What we lock down:
 *   1. A valid 1 KB PNG under the cap returns 200 with a `url` field.
 *   2. A 6 MB payload triggers the 5 MB multer cap → 413 with the exact
 *      Arabic message from UploadExceptionFilter (`حجم الملف يتجاوز 5 ميجابايت`).
 *   3. application/pdf is rejected by fileFilter → 400 (`نوع ملف غير مدعوم`).
 *
 * Storage destination defaults to `/var/uploads`, which the test runner can't
 * write to. We override UPLOADS_DIR to a per-suite tmp dir in beforeAll so
 * the success path actually writes a file (still cheap — 1 KB).
 */
import request from 'supertest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { createTestApp, closeTestApp, truncateAll, describeIfDb } from './setup';
import { seedTwoTenants, TwoTenants } from './fixtures';

describeIfDb('POST /api/v1/uploads/proof', () => {
  let server: any;
  let seeds: TwoTenants;
  let driverToken: string;
  let tmpDir: string;

  beforeAll(async () => {
    // UPLOADS_DIR is read at module-import time by uploads.controller.ts.
    // We can't shift it after AppModule loads. The default /var/uploads/proof
    // won't exist on most dev machines, so we point it at a tmp dir BEFORE
    // creating the test app. Note: if /var/uploads happens to exist + be
    // writable (root setup), this test still works — multer creates the
    // subdir as needed.
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daari-uploads-'));
    process.env.UPLOADS_DIR = tmpDir;

    const { app, prisma } = await createTestApp();
    server = app.getHttpServer();
    await truncateAll(prisma);
    seeds = await seedTwoTenants(prisma);

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: seeds.t1.driverPhone, password: seeds.t1.driverPassword });
    driverToken = login.body.accessToken;
  });
  afterAll(async () => {
    await closeTestApp();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1 KB PNG → 200 with url', async () => {
    // Minimal valid PNG (signature + IHDR + IEND). We don't strictly need
    // the file to *decode* — multer's fileFilter only checks the MIME the
    // client claims. Buffer size is what the LIMIT_FILE_SIZE handler watches.
    const png = Buffer.alloc(1024);
    // PNG signature so anything that does inspect bytes sees a real header.
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);

    const res = await request(server)
      .post('/api/v1/uploads/proof')
      .set('Authorization', `Bearer ${driverToken}`)
      .attach('photo', png, { filename: 'proof.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(typeof res.body.url).toBe('string');
    expect(res.body.url).toContain('/uploads/proof/');
  });

  it('6 MB file → 413 with Arabic size-cap message', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024, 0x42);
    const res = await request(server)
      .post('/api/v1/uploads/proof')
      .set('Authorization', `Bearer ${driverToken}`)
      .attach('photo', big, { filename: 'huge.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.message).toBe('حجم الملف يتجاوز 5 ميجابايت');
  });

  it('application/pdf → 400 with unsupported-type message', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%fake pdf bytes\n');
    const res = await request(server)
      .post('/api/v1/uploads/proof')
      .set('Authorization', `Bearer ${driverToken}`)
      .attach('photo', pdf, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('نوع ملف غير مدعوم');
  });
});
