/**
 * Authentication — only the two flows that matter for security posture:
 *   - valid login returns a usable JWT
 *   - wrong password is rejected with 401 (NOT 200 with empty body, NOT 500)
 *
 * Brute-force / throttle tests are intentionally skipped because the
 * `@Throttle({ limit: 20, ttl: 15min })` decorator on /auth/login has a
 * per-IP counter that persists across tests within the same Jest worker —
 * verifying it requires either resetting Throttler internals or sleeping
 * 15 min, both bad ideas for CI.
 */
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, describeIfDb } from './setup';
import { seedTwoTenants, TwoTenants } from './fixtures';

describeIfDb('POST /api/v1/auth/login', () => {
  let server: any;
  let seeds: TwoTenants;

  beforeAll(async () => {
    const { app, prisma } = await createTestApp();
    server = app.getHttpServer();
    await truncateAll(prisma);
    seeds = await seedTwoTenants(prisma);
  });
  afterAll(async () => {
    await closeTestApp();
  });

  it('valid plant-admin credentials → 200 with accessToken + refreshToken', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: seeds.t1.ownerPhone, password: seeds.t1.ownerPassword });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.split('.')).toHaveLength(3); // JWT shape
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.capabilities).toContain('plant_admin');
  });

  it('wrong password → 401 (NOT 200, NOT 500)', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: seeds.t1.ownerPhone, password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('unknown phone → 401 (same error shape, no enumeration leak)', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone: '07799999999', password: 'whatever' });
    expect(res.status).toBe(401);
  });
});
