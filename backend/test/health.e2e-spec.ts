/**
 * Health probe coverage. Cheapest possible smoke-test — proves the app
 * boots, controllers resolve, and the global prefix is wired.
 */
import request from 'supertest';
import { createTestApp, closeTestApp, describeIfDb } from './setup';

describeIfDb('GET /api/v1/health & /ready', () => {
  let server: any;

  beforeAll(async () => {
    const { app } = await createTestApp();
    server = app.getHttpServer();
  });
  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /api/v1/health → 200 { status: "ok" }', async () => {
    const res = await request(server).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/v1/ready → 200 with db:"ok" when Postgres is reachable', async () => {
    const res = await request(server).get('/api/v1/ready');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('ok');
  });
});
