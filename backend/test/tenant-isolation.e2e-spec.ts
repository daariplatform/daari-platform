/**
 * THE MOST IMPORTANT TEST IN THIS SUITE.
 *
 * If tenant isolation breaks, plant A can read plant B's customer list —
 * which would be a catastrophic data leak for a multi-tenant SaaS.
 * Production code calls `prisma.findFirst({ where: { id, tenantId } })`
 * for every read; these tests pin that contract.
 *
 * Coverage:
 *   1. T1 owner can list customers and sees only T1's customer
 *   2. T1 owner asking for T2's customer by id gets 404 (not 200 + leak)
 *   3. Same isolation guarantee for orders + tanks (lookup-by-id branches)
 *
 * Drivers don't expose a GET /drivers/:id route (only /me, /live, /:id/route
 * with auth-gated assignments) — covered by the orders + tanks checks.
 */
import request from 'supertest';
import { createTestApp, closeTestApp, truncateAll, describeIfDb } from './setup';
import { seedTwoTenants, TwoTenants } from './fixtures';

describeIfDb('Multi-tenant isolation', () => {
  let server: any;
  let seeds: TwoTenants;
  let t1Token: string;

  async function loginAs(phone: string, password: string): Promise<string> {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ phone, password });
    if (res.status !== 200) {
      throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return res.body.accessToken;
  }

  beforeAll(async () => {
    const { app, prisma } = await createTestApp();
    server = app.getHttpServer();
    await truncateAll(prisma);
    seeds = await seedTwoTenants(prisma);
    t1Token = await loginAs(seeds.t1.ownerPhone, seeds.t1.ownerPassword);

    // T1 places an order so /orders list has something for T1, and T2 has
    // its own order so the cross-fetch lookup has a real id to chase.
    await prisma.refillOrder.create({
      data: { tenantId: seeds.t1.tenantId, customerId: seeds.t1.customerId, tankId: seeds.t1.tankId, priceIqd: 1000 },
    });
    await prisma.refillOrder.create({
      data: { tenantId: seeds.t2.tenantId, customerId: seeds.t2.customerId, tankId: seeds.t2.tankId, priceIqd: 1000 },
    });
  });
  afterAll(async () => {
    await closeTestApp();
  });

  it('GET /customers returns ONLY T1 customer (T2 customer not in items)', async () => {
    const res = await request(server)
      .get('/api/v1/customers?page=1&pageSize=50')
      .set('Authorization', `Bearer ${t1Token}`);
    expect(res.status).toBe(200);
    const ids: string[] = res.body.items.map((c: any) => c.id);
    expect(ids).toContain(seeds.t1.customerId);
    expect(ids).not.toContain(seeds.t2.customerId);
  });

  it('GET /customers/:id with T2 customer id under T1 token → 404 (NEVER leak)', async () => {
    const res = await request(server)
      .get(`/api/v1/customers/${seeds.t2.customerId}`)
      .set('Authorization', `Bearer ${t1Token}`);
    // Service uses `findFirst({ where: { id, tenantId } })` — when the
    // tenantId doesn't match, this returns null → NotFoundException.
    expect([403, 404]).toContain(res.status);
    expect(res.body.fullName).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
  });

  it('GET /tanks/qr/:code with T2 qr code under T1 token → 404', async () => {
    const res = await request(server)
      .get(`/api/v1/tanks/qr/T2-QR-001`)
      .set('Authorization', `Bearer ${t1Token}`);
    expect([403, 404]).toContain(res.status);
    expect(res.body.serialNumber).toBeUndefined();
  });

  it('POST /orders/:id/assign for a T2 order under T1 token → 404', async () => {
    // Look up T2's order id.
    const { prisma } = await createTestApp();
    const t2Order = await prisma.refillOrder.findFirst({
      where: { tenantId: seeds.t2.tenantId },
    });
    expect(t2Order).not.toBeNull();
    const res = await request(server)
      .post(`/api/v1/orders/${t2Order!.id}/assign`)
      .set('Authorization', `Bearer ${t1Token}`)
      .send({ driverId: seeds.t1.driverId });
    expect([403, 404]).toContain(res.status);
  });

  it('list /orders under T1 token excludes T2 orders', async () => {
    const res = await request(server)
      .get('/api/v1/orders?page=1&pageSize=50')
      .set('Authorization', `Bearer ${t1Token}`);
    expect(res.status).toBe(200);
    const tenantIds: string[] = res.body.items.map((o: any) => o.tenantId);
    // Every returned row must belong to T1; no row may be T2's.
    for (const tid of tenantIds) expect(tid).toBe(seeds.t1.tenantId);
  });
});
